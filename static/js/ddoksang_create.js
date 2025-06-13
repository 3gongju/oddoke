// 단계별 검증 규칙
const stepValidationRules = {
    1: ['final_artist_id'],
    2: ['cafe_name', 'address', 'latitude', 'longitude'],
    3: ['start_date', 'end_date'],
    4: ['event_description'],
    5: [], // 선택사항
    6: ['images'] // 이미지 검증은 별도 처리
};

// 전역 함수들 (HTML onclick 용)
window.clearSelection = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.setValue('artist-member-search', '');
    FormUtils.setValue('check_artist_id', '');
    FormUtils.setValue('check_member_id', '');
    FormUtils.toggleClass('selected-artist', 'hidden', true);
    FormUtils.toggleClass('duplicate-warning', 'hidden', true);
    FormUtils.toggleClass('duplicate-success', 'hidden', true);
    
    if (window.ddoksangApp) {
        window.ddoksangApp.duplicateChecked = false;
        window.ddoksangApp.isDuplicate = false;
    }
    
    if (window.updateDuplicateButtonState) window.updateDuplicateButtonState();
};

window.useSelectedArtist = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.setValue('final_artist_id', FormUtils.getValue('check_artist_id'));
    FormUtils.setValue('final_member_id', FormUtils.getValue('check_member_id'));
    
    setTimeout(() => window.ddoksangApp?.moveToStep(2), 300);
};

window.showArtistSearch = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.toggleClass('step1-confirm-mode', 'hidden', true);
    FormUtils.toggleClass('step1-search-mode', 'hidden', false);
    document.getElementById('final-artist-member-search')?.focus();
    window.ddoksangApp?.updateNextButtonState();
};

window.cancelArtistSearch = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.toggleClass('step1-search-mode', 'hidden', true);
    FormUtils.toggleClass('step1-confirm-mode', 'hidden', false);
    window.ddoksangApp?.updateNextButtonState();
};

window.confirmNewArtist = function() {
    const finalArtistId = window.DdoksangFormUtils.getValue('final_artist_id');
    if (!finalArtistId) {
        // ✅ 중앙화된 메시지 사용 필요 (alert는 일단 유지)
        alert('아티스트를 선택해주세요.');
        return;
    }
    setTimeout(() => window.ddoksangApp?.moveToStep(2), 300);
};

window.clearFinalSelection = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.setValue('final-artist-member-search', '');
    FormUtils.setValue('final_artist_id', '');
    FormUtils.setValue('final_member_id', '');
    FormUtils.toggleClass('final-selected-artist', 'hidden', true);
    FormUtils.updateButtonState('confirm-new-artist-btn', false);
    window.ddoksangApp?.updateNextButtonState();
};

document.addEventListener('DOMContentLoaded', function() {
    
    // 의존성 확인
    const { DdoksangFormUtils: FormUtils, DdoksangMapUtils: MapUtils } = window;
    if (!FormUtils || !MapUtils) {
        return;
    }

    // DOM 요소
    const steps = document.querySelectorAll(".step");
    const progressBar = document.getElementById("progressBar");
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const totalSteps = steps.length;
    
    // 상태 변수
    let currentStep = 0;
    let duplicateChecked = false;
    let isDuplicate = false;
    let imageUploadModule = null;

    // 전역 앱 객체
    window.ddoksangApp = {
        currentStep: 0,
        duplicateChecked: false,
        isDuplicate: false,
        moveToStep: (step) => { currentStep = step; showStep(step); },
        updateNextButtonState,
        imageUploadModule: null
    };

    // 초기화
    init();

    function init() {
        setupEventListeners();
        initializeDatePickers();
        initializeAutocomplete();
        initializeImageUpload();
        initializeMapSearch();
        initializeFormSubmit();
        initDuplicateChecker();
        showStep(0);
    }

    function setupEventListeners() {
        nextBtn?.addEventListener("click", () => moveStep(1));
        prevBtn?.addEventListener("click", () => moveStep(-1));
    }

    function showStep(index) {
        currentStep = index;
        window.ddoksangApp.currentStep = index;
        
        steps.forEach((step, i) => step.classList.toggle("hidden", i !== index));
        if (progressBar) progressBar.style.width = `${(index / (totalSteps - 1)) * 100}%`;
        
        updateNavigationButtons(index);
        addStepValidationListeners(index);
        updateNextButtonState();

        if (index === 2 && !MapUtils.map) {
            setTimeout(() => MapUtils.initMap(), 100);
        }
    }

    function updateNavigationButtons(index) {
        const isFirstStep = index === 0;
        const isLastStep = index === totalSteps - 1;

        if (isFirstStep) {
            prevBtn?.classList.add("hidden");
            nextBtn?.classList.add("hidden");
        } else {
            prevBtn?.classList.remove("hidden");
            nextBtn?.classList.remove("hidden");
            
            if (nextBtn) nextBtn.textContent = isLastStep ? "제출하기" : "다음";
            FormUtils.updateButtonState('prevBtn', true);
        }
    }

    function moveStep(direction) {
        if (direction === -1) {
            if (currentStep === 1) {
                FormUtils.showToast(msg('DUPLICATE_CHECK', 'BACK_TO_DUPLICATE_CHECK'), 'info');
                resetDuplicateCheck();
                showStep(0);
                return;
            } else if (currentStep > 1) {
                showStep(currentStep - 1);
                return;
            }
        }

        if (direction === 1) {
            if (currentStep === 0) {
                if (!duplicateChecked || isDuplicate) {
                    FormUtils.showToast(
                        isDuplicate ? 
                            msg('DUPLICATE_CHECK', 'DUPLICATE_WARNING') : 
                            msg('DUPLICATE_CHECK', 'CHECK_REQUIRED'), 
                        'warning'
                    );
                    return;
                }
                setupStep1Preview();
            }

            if (!validateCurrentStep()) return;

            if (currentStep + direction === 2) {
                copyDataToForm();
            }

            if (currentStep === totalSteps - 1) {
                showSubmitConfirmModal();
                return;
            }

            showStep(currentStep + 1);
        }
    }

    function validateCurrentStep() {
        const rules = stepValidationRules[currentStep];
        if (!rules) return true;

        const normalFields = rules.filter(field => field !== 'images');
        if (normalFields.length > 0) {
            const validation = FormUtils.validateRequired(normalFields);
            if (!validation.valid) {
                // ✅ 중앙화된 메시지 사용
                const fieldLabel = getFieldLabel(validation.field);
                FormUtils.showToast(msg('FORM_VALIDATION', 'REQUIRED_FIELD', {field: fieldLabel}), 'warning');
                return false;
            }
        }

        if (rules.includes('images')) {
            if (!imageUploadModule || imageUploadModule.getFileCount() === 0) {
                // ✅ 중앙화된 메시지 사용
                FormUtils.showToast(msg('FORM_VALIDATION', 'IMAGE_REQUIRED'), 'warning');
                return false;
            }
        }

        if (currentStep === 3) {
            const dateValidation = FormUtils.validateDateRange('start_date', 'end_date');
            if (!dateValidation.valid) {
                // ✅ 중앙화된 메시지 사용
                FormUtils.showToast(msg('FORM_VALIDATION', 'DATE_RANGE_ERROR'), 'warning');
                return false;
            }
        }

        return true;
    }

    function getFieldLabel(fieldId) {
        // ✅ 중앙화된 메시지 사용
        return msg('FIELD_LABELS', fieldId) || fieldId;
    }

    function addStepValidationListeners(stepIndex) {
        const stepElement = document.getElementById(`step-${stepIndex}`);
        if (!stepElement || stepElement.hasAttribute('data-listeners-added')) return;
        
        stepElement.setAttribute('data-listeners-added', 'true');
        
        stepValidationRules[stepIndex]?.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && fieldId !== 'images') {
                element.addEventListener('input', updateNextButtonState);
                element.addEventListener('change', updateNextButtonState);
            }
        });

        if (stepIndex === 2) {
            document.getElementById('place-search')?.addEventListener('input', updateNextButtonState);
        }
    }

    function updateNextButtonState() {
        if (!nextBtn || currentStep === 0) return;

        const rules = stepValidationRules[currentStep];
        let isValid = true;

        if (rules?.length > 0) {
            const normalFields = rules.filter(field => field !== 'images');
            if (normalFields.length > 0) {
                const validation = FormUtils.validateRequired(normalFields, false);
                isValid = validation.valid;
            }

            if (rules.includes('images')) {
                const uploader = window.ddoksangApp?.imageUploadModule;
                const count = uploader?.getFileCount?.() || 0;
                isValid = isValid && count > 0;
            }
        }

        FormUtils.updateButtonState('nextBtn', isValid);
    }

    function showSubmitConfirmModal() {
        const modalHTML = `
            <div id="submitConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                    <div class="text-center">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 mb-2">생카 등록 완료</h3>
                        <p class="text-gray-600 mb-6">모든 내용을 확인하셨나요?<br>등록하시겠습니까?</p>
                        <div class="flex gap-3">
                            <button id="cancelSubmit" class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">취소</button>
                            <button id="confirmSubmit" class="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">등록하기</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('cancelSubmit').addEventListener('click', closeSubmitModal);
        document.getElementById('confirmSubmit').addEventListener('click', function() {
            closeSubmitModal();
            document.getElementById("multiStepForm")?.submit();
        });
        document.addEventListener('keydown', handleModalEscape);
    }

    function closeSubmitModal() {
        document.getElementById('submitConfirmModal')?.remove();
        document.removeEventListener('keydown', handleModalEscape);
    }

    function handleModalEscape(e) {
        if (e.key === 'Escape') closeSubmitModal();
    }

    function setupStep1Preview() {
        FormUtils.toggleClass('step1-confirm-mode', 'hidden', false);
        FormUtils.toggleClass('step1-search-mode', 'hidden', true);
    }

    function copyDataToForm() {
        FormUtils.setValue('cafe_name', FormUtils.getValue('check_cafe_name'));
    }

    function resetDuplicateCheck() {
        duplicateChecked = false;
        isDuplicate = false;
        window.ddoksangApp.duplicateChecked = false;
        window.ddoksangApp.isDuplicate = false;
        
        const duplicateForm = document.getElementById('duplicate-check-form');
        const duplicateSection = document.getElementById('duplicate-cafes-section');
        const successMsg = document.getElementById('duplicate-success');
        const warningMsg = document.getElementById('duplicate-warning');
        
        if (duplicateForm) duplicateForm.style.display = 'block';
        
        const section = document.querySelector('section.max-w-4xl');
        if (section) {
            const title = section.querySelector('h1');
            const description = section.querySelector('p');
            const progressBar = section.querySelector('.w-full.bg-gray-200.rounded-full');
            
            if (title) title.style.display = 'block';
            if (description) description.style.display = 'block';
            if (progressBar) progressBar.style.display = 'block';
        }
        
        if (duplicateSection) duplicateSection.classList.add('hidden');
        if (successMsg) successMsg.classList.add('hidden');
        if (warningMsg) warningMsg.classList.add('hidden');
        
        FormUtils.setValue('selected_duplicate_cafe_id', '');
        
        if (window.updateDuplicateButtonState) {
            window.updateDuplicateButtonState();
        }
    }

    function initDuplicateChecker() {
        const checkBtn = document.getElementById('check-duplicate-btn');
        if (!checkBtn) {
            return;
        }

        function updateDuplicateButtonState() {
            const required = ['check_artist_id', 'check_cafe_name', 'check_start_date', 'check_end_date'];
            let isValid = true;

            for (const fieldId of required) {
                const element = document.getElementById(fieldId);
                const value = element ? element.value.trim() : '';
                
                if (!value) {
                    isValid = false;
                    break;
                }
            }

            checkBtn.disabled = !isValid;
            
            if (isValid) {
                checkBtn.style.backgroundColor = '#111827';
                checkBtn.style.color = '#ffffff';
                checkBtn.style.cursor = 'pointer';
                checkBtn.className = checkBtn.className
                    .replace(/bg-gray-\d+|text-gray-\d+|cursor-\w+|hover:bg-gray-\d+/g, '')
                    .trim() + ' bg-gray-900 text-white hover:bg-gray-800';
            } else {
                checkBtn.style.backgroundColor = '#9ca3af';
                checkBtn.style.color = '#d1d5db';
                checkBtn.style.cursor = 'not-allowed';
                checkBtn.className = checkBtn.className
                    .replace(/bg-gray-\d+|text-gray-\d+|cursor-\w+|hover:bg-gray-\d+/g, '')
                    .trim() + ' bg-gray-400 text-gray-200 cursor-not-allowed';
            }
        }

        window.updateDuplicateButtonState = updateDuplicateButtonState;

        const eventFields = ['check_cafe_name', 'check_start_date', 'check_end_date'];
        
        eventFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.removeEventListener('input', updateDuplicateButtonState);
                element.removeEventListener('change', updateDuplicateButtonState);
                element.removeEventListener('keyup', updateDuplicateButtonState);
                
                element.addEventListener('input', updateDuplicateButtonState);
                element.addEventListener('change', updateDuplicateButtonState);
                element.addEventListener('keyup', updateDuplicateButtonState);
            }
        });

        checkBtn.removeEventListener('click', performDuplicateCheck);
        checkBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (!checkBtn.disabled) {
                performDuplicateCheck();
            }
        });

        setupDuplicateSelectionButtons();
        
        setTimeout(() => {
            updateDuplicateButtonState();
        }, 100);
    }

    async function performDuplicateCheck() {
        const checkBtn = document.getElementById('check-duplicate-btn');
        
        if (checkBtn.disabled) {
            return;
        }

        const data = {
            artist_id: FormUtils.getValue('check_artist_id'),
            member_id: FormUtils.getValue('check_member_id'),
            cafe_name: FormUtils.getValue('check_cafe_name'),
            start_date: FormUtils.getValue('check_start_date'),
            end_date: FormUtils.getValue('check_end_date')
        };

        // ✅ 중앙화된 메시지 사용
        if (!data.artist_id || !data.cafe_name || !data.start_date || !data.end_date) {
            FormUtils.showToast(msg('DUPLICATE_CHECK', 'VALIDATION_ERROR'), 'warning');
            return;
        }

        const originalText = checkBtn.textContent;
        const originalDisabled = checkBtn.disabled;
        
        checkBtn.disabled = true;
        // ✅ 중앙화된 메시지 사용
        checkBtn.textContent = msg('DUPLICATE_CHECK', 'CHECKING_DUPLICATE');
        checkBtn.className = checkBtn.className
            .replace(/bg-gray-\d+|hover:bg-gray-\d+/g, '')
            + ' bg-gray-600';

        try {
            const url = `/ddoksang/cafe/check-duplicate/?` + 
                Object.entries(data)
                    .filter(([k, v]) => v)
                    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
                    .join('&');
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            handleDuplicateCheckResult(result);
            
        } catch (error) {
            // ✅ 중앙화된 메시지 사용 (일부 하드코딩 유지 - 동적 에러 메시지)
            FormUtils.showToast(`중복 확인 중 오류: ${error.message}`, 'error');
            
            hideDuplicateCheckForm();
            showErrorMessage(error.message);
            
        } finally {
            checkBtn.disabled = originalDisabled;
            checkBtn.textContent = originalText;
            
            if (window.updateDuplicateButtonState) {
                window.updateDuplicateButtonState();
            }
        }
    }

    function handleDuplicateCheckResult(result) {
        duplicateChecked = true;
        isDuplicate = result.exists;
        
        window.ddoksangApp.duplicateChecked = duplicateChecked;
        window.ddoksangApp.isDuplicate = isDuplicate;

        hideDuplicateCheckForm();

        if (result.exists && result.similar_cafes?.length > 0) {
            showDuplicateCafes(result.similar_cafes);
            // ✅ 중앙화된 메시지 사용
            FormUtils.showToast(msg('DUPLICATE_CHECK', 'DUPLICATE_FOUND', {count: result.similar_cafes.length}), 'warning');
        } else {
            FormUtils.toggleClass('duplicate-success', 'hidden', false);
            // ✅ 중앙화된 메시지 사용
            FormUtils.showToast(msg('DUPLICATE_CHECK', 'NO_DUPLICATE'), 'success');
            setTimeout(() => showStep(1), 1500);
        }
    }

    function hideDuplicateCheckForm() {
        const form = document.getElementById('duplicate-check-form');
        if (form) form.style.display = 'none';
        
        const section = document.querySelector('section.max-w-4xl');
        if (section) {
            const title = section.querySelector('h1');
            const description = section.querySelector('p');
            const progressBar = section.querySelector('.w-full.bg-gray-200.rounded-full');
            
            if (title) title.style.display = 'none';
            if (description) description.style.display = 'none';
            if (progressBar) progressBar.style.display = 'none';
        }
    }

    function showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mt-6 p-4 border rounded bg-red-50 border-red-200';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <svg class="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <div>
                    <span class="font-medium text-red-800">오류가 발생했습니다</span>
                    <p class="text-sm text-red-600 mt-1">${message}</p>
                    <button type="button" onclick="location.reload()" class="mt-2 text-sm text-red-600 underline hover:text-red-800">다시 시도하기</button>
                </div>
            </div>
        `;
        document.getElementById('step-0')?.appendChild(errorDiv);
    }

    function showDuplicateCafes(cafes) {
        const section = document.getElementById('duplicate-cafes-section');
        const grid = document.getElementById('duplicate-cafes-grid');
        if (!section || !grid) return;
        
        grid.innerHTML = '';
        cafes.forEach(cafe => {
            const cardElement = createDuplicateCafeCard(cafe);
            grid.appendChild(cardElement);
        });
        section.classList.remove('hidden');
    }

    function createDuplicateCafeCard(cafe) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'duplicate-cafe-card relative w-full max-w-sm mx-auto mb-6';
        cardDiv.dataset.cafeId = cafe.id;
        
        let statusBadge = '';
        let statusClass = '';
        if (cafe.cafe_state === 'ongoing') {
            statusBadge = '운영중'; statusClass = 'bg-green-500';
        } else if (cafe.cafe_state === 'upcoming') {
            statusBadge = '예정'; statusClass = 'bg-blue-500';
        } else {
            statusBadge = '종료'; statusClass = 'bg-gray-500';
        }
        
        let daysInfo = '';
        if (cafe.days_until_start && cafe.days_until_start <= 7) {
            daysInfo = `<span class="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">시작 D-${cafe.days_until_start}</span>`;
        } else if (cafe.days_remaining && cafe.days_remaining <= 7) {
            daysInfo = `<span class="text-red-600 font-medium text-xs bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">종료 D-${cafe.days_remaining}</span>`;
        }
        
        cardDiv.innerHTML = `
            <div class="relative overflow-hidden rounded-2xl border border-gray-200 transition-all duration-300 h-80 bg-white shadow-sm">
                ${cafe.cafe_state === 'ended' ? '<div class="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px] z-30 rounded-2xl pointer-events-none"></div>' : ''}
                
                <div class="selected-indicator absolute top-3 left-3 z-40 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                
                <div class="relative h-48">
                    ${cafe.main_image ? 
                        `<img src="${cafe.main_image}" alt="${cafe.cafe_name}" class="w-full h-full object-cover" loading="lazy">` :
                        `<div class="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                            <span class="text-pink-400 text-4xl">🎂</span>
                        </div>`
                    }
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-0"></div>
                    <div class="absolute -bottom-3 right-3 z-40">
                        <span class="${statusClass} text-white text-xs font-medium px-2 py-1 rounded-full">${statusBadge}</span>
                    </div>
                </div>
                
                <div class="bg-white p-4 h-32 flex flex-col justify-between">
                    <div class="flex-1 space-y-1">
                        <p class="text-sm text-gray-600 truncate leading-tight">
                            ${cafe.member_name ? `${cafe.member_name} (${cafe.artist_name})` : cafe.artist_name}
                        </p>
                        <p class="text-base font-semibold text-gray-900 line-clamp-2 leading-tight">
                            ${cafe.cafe_name}
                        </p>
                    </div>
                    <div class="mb-2">
                        <p class="text-xs text-gray-600 truncate">📍 ${cafe.place_name}</p>
                    </div>
                    <div class="flex items-center justify-between text-sm text-gray-600 mt-auto">
                        <span class="truncate">${cafe.start_date} - ${cafe.end_date}</span>
                        ${daysInfo}
                    </div>
                </div>
            </div>
        `;
        
        cardDiv.addEventListener('click', () => selectDuplicateCafe(cafe.id, cardDiv));
        return cardDiv;
    }

    function selectDuplicateCafe(cafeId, cardElement) {
        document.querySelectorAll('.duplicate-cafe-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        cardElement.classList.add('selected');
        FormUtils.setValue('selected_duplicate_cafe_id', cafeId);
        FormUtils.toggleClass('select-cafe-instruction', 'hidden', false);
    }

    function setupDuplicateSelectionButtons() {
        document.getElementById('confirm-duplicate-btn')?.addEventListener('click', () => {
            const selectedCafeId = FormUtils.getValue('selected_duplicate_cafe_id');
            if (!selectedCafeId) {
                // ✅ 중앙화된 메시지 사용
                FormUtils.showToast(msg('DUPLICATE_CHECK', 'SELECT_CAFE_FIRST'), 'warning');
                FormUtils.toggleClass('select-cafe-instruction', 'hidden', false);
                return;
            }
            
            // ✅ 중앙화된 메시지 사용
            FormUtils.showToast(msg('DUPLICATE_CHECK', 'REDIRECTING_TO_CAFE'), 'info');
            setTimeout(() => {
                window.location.href = `/ddoksang/cafe/${selectedCafeId}/`;
            }, 1000);
        });
        
        document.getElementById('deny-duplicate-btn')?.addEventListener('click', () => {
            duplicateChecked = true;
            isDuplicate = false;
            window.ddoksangApp.duplicateChecked = duplicateChecked;
            window.ddoksangApp.isDuplicate = isDuplicate;
            
            // ✅ 중앙화된 메시지 사용
            FormUtils.showToast(msg('DUPLICATE_CHECK', 'REGISTER_NEW_CAFE'), 'success');
            setTimeout(() => showStep(1), 1000);
        });
    }

    function initializeDatePickers() {
        if (typeof flatpickr === 'undefined') return;

        flatpickr("#check_start_date", { 
            dateFormat: "Y-m-d",
            onChange: () => window.updateDuplicateButtonState?.()
        });
        flatpickr("#check_end_date", { 
            dateFormat: "Y-m-d",
            onChange: () => window.updateDuplicateButtonState?.()
        });
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

    function initializeAutocomplete() {
        if (typeof initAutocomplete !== 'function') return;

        const autocompleteConfig = {
            showBirthday: true,
            showArtistTag: false,
            submitOnSelect: false,
            artistOnly: false,
            apiUrl: '/artist/autocomplete/'
        };

        initAutocomplete('artist-member-search', 'artist-member-results', {
            ...autocompleteConfig,
            onSelect: (result) => selectArtist(result, 'check')
        });

        initAutocomplete('final-artist-member-search', 'final-artist-member-results', {
            ...autocompleteConfig,
            onSelect: (result) => selectFinalArtist(result)
        });
    }

    function selectArtist(result, prefix) {
        const data = FormUtils.normalizeArtistData({
            member_name: result.name,
            artist_display: result.artist || result.artist_name,
            artist_id: result.artist_id,
            member_id: result.id || result.member_id
        });

        FormUtils.setValue(`${prefix}_artist_id`, data.artistId);
        FormUtils.setValue(`${prefix}_member_id`, data.memberId);
        FormUtils.setValue(`artist-member-search`, data.displayText);
        FormUtils.setText('selected-artist-text', `✓ ${data.displayText} 선택됨`);
        
        FormUtils.toggleClass('artist-member-results', 'hidden', true);
        FormUtils.toggleClass('selected-artist', 'hidden', false);
        
        if (prefix === 'check') {
            setTimeout(() => {
                if (window.updateDuplicateButtonState) {
                    window.updateDuplicateButtonState();
                }
            }, 50);
        } else {
            updateNextButtonState();
        }
    }

    function selectFinalArtist(result) {
        const data = FormUtils.normalizeArtistData({
            member_name: result.name,
            artist_display: result.artist || result.artist_name,
            artist_id: result.artist_id,
            member_id: result.id || result.member_id
        });

        FormUtils.setValue('final_artist_id', data.artistId);
        FormUtils.setValue('final_member_id', data.memberId);
        FormUtils.setValue('final-artist-member-search', data.displayText);
        FormUtils.setText('final-selected-artist-text', `✓ ${data.displayText} 선택됨`);
        
        FormUtils.toggleClass('final-artist-member-results', 'hidden', true);
        FormUtils.toggleClass('final-selected-artist', 'hidden', false);
        FormUtils.updateButtonState('confirm-new-artist-btn', true);
        updateNextButtonState();
    }

    function initializeImageUpload() {
        const imageContainer = document.getElementById('image-upload-container');
        if (imageContainer && window.setupDdoksangImageUpload) {
            try {
                imageUploadModule = window.setupDdoksangImageUpload({
                    fileInputId: "image-upload",
                    fileCountId: "file-count", 
                    previewContainerId: "image-upload-container",
                    previewListId: "image-preview-list",
                    formId: "multiStepForm",
                    maxFiles: 10,
                    maxSizeMB: 5
                });
                window.ddoksangApp.imageUploadModule = imageUploadModule;
            } catch (error) {
                console.error('❌ 이미지 업로드 모듈 초기화 실패:', error);
            }
        }
    }

    function initializeMapSearch() {
        const searchBtn = document.getElementById("searchBtn");
        const placeInput = document.getElementById("place-search");

        searchBtn?.addEventListener('click', searchPlace);
        placeInput?.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchPlace();
            }
        });
    }

    function searchPlace() {
        const keyword = FormUtils.getValue('place-search');
        if (!keyword) {
            // ✅ 중앙화된 메시지 사용
            FormUtils.showToast(msg('FORM_VALIDATION', 'SEARCH_KEYWORD_REQUIRED'), 'warning');
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

        FormUtils.toggleClass('place-results', 'hidden', true);
        updateNextButtonState();
    }

    function initializeFormSubmit() {
        const form = document.getElementById('multiStepForm');
        if (!form) return;
        
        form.addEventListener('submit', function(e) {
            this.querySelectorAll('input, textarea, select').forEach(input => {
                input.disabled = false;
            });

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

    // CSS 스타일 추가
    const additionalCSS = `
        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .duplicate-cafe-card {
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            border: 2px solid transparent;
        }
        
        .duplicate-cafe-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        
        .duplicate-cafe-card.selected {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            transform: translateY(-2px);
        }
        
        .duplicate-cafe-card .selected-indicator {
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .duplicate-cafe-card.selected .selected-indicator {
            opacity: 1;
        }
        
        #duplicate-cafes-grid {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
        }

        #check-duplicate-btn {
            transition: all 0.2s ease-in-out;
            border: none;
            font-weight: 600;
            font-size: 0.875rem;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            min-height: 3rem;
        }
        
        #check-duplicate-btn:not([disabled]) {
            background-color: #111827 !important;
            color: #ffffff !important;
            cursor: pointer !important;
        }
        
        #check-duplicate-btn:not([disabled]):hover {
            background-color: #1f2937 !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        #check-duplicate-btn[disabled] {
            background-color: #9ca3af !important;
            color: #d1d5db !important;
            cursor: not-allowed !important;
            transform: none !important;
            box-shadow: none !important;
        }
        
        #check-duplicate-btn.loading {
            background-color: #6b7280 !important;
            cursor: wait !important;
            position: relative;
        }
        
        #check-duplicate-btn.loading::after {
            content: '';
            position: absolute;
            right: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            width: 1rem;
            height: 1rem;
            border: 2px solid #ffffff;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: translateY(-50%) rotate(0deg); }
            100% { transform: translateY(-50%) rotate(360deg); }
        }
    `;

    if (!document.querySelector('#duplicate-check-styles')) {
        const style = document.createElement('style');
        style.id = 'duplicate-check-styles';
        style.textContent = additionalCSS;
        document.head.appendChild(style);
    }
});