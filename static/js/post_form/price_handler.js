// static/js/post_form/price_handler.js - 수정 모드 지원 개선

export function setupPriceHandlers() {
    const singlePriceMode = document.getElementById('single-price-mode');
    const multiplePriceMode = document.getElementById('multiple-items-mode');
    const addItemsBtn = document.getElementById('add-items-btn');
    const addAnotherItemBtn = document.getElementById('add-another-item-btn');
    const backToSingleBtn = document.getElementById('back-to-single-btn');
    const itemsList = document.getElementById('items-list');
    const itemTemplate = document.getElementById('item-template');

    if (!singlePriceMode || !multiplePriceMode) return;

    // 🔧 기존 ItemPrice 데이터 확인 (수정 모드)
    const existingItemPrices = window.existingItemPrices || [];
    console.log('Existing item prices:', existingItemPrices);

    let itemCounter = getInitialItemCount();
    let currentMode = determineInitialMode();

    // 초기 아이템 개수 확인
    function getInitialItemCount() {
        const existingItems = itemsList.querySelectorAll('.item-row');
        const existingCount = existingItems.length;
        const dataCount = existingItemPrices.length;
        
        console.log('Initial item count - DOM:', existingCount, 'Data:', dataCount);
        return Math.max(existingCount, dataCount);
    }

    // 🔧 초기 모드 결정
    function determineInitialMode() {
        // 기존 데이터가 있으면 해당 개수에 따라 결정
        if (existingItemPrices.length > 1) {
            return 'multiple';
        } else if (existingItemPrices.length === 1) {
            // 단일 아이템이면서 이름이 비어있으면 단일 모드
            const item = existingItemPrices[0];
            return (!item.item_name || item.item_name.trim() === '') ? 'single' : 'multiple';
        }
        // DOM에 아이템이 있으면 다중 모드
        return itemCounter > 0 ? 'multiple' : 'single';
    }

    // 🔧 수정 모드에서 기존 데이터로 아이템 초기화
    function initializeExistingItems() {
        if (existingItemPrices.length === 0) return;

        if (currentMode === 'single' && existingItemPrices.length === 1) {
            // 단일 모드: 첫 번째 아이템 데이터를 단일 가격 필드에 설정
            const item = existingItemPrices[0];
            const singlePriceInput = document.getElementById('single-price-input');
            const singlePriceUndetermined = document.getElementById('single-price-undetermined');
            
            if (singlePriceInput && singlePriceUndetermined) {
                if (item.is_price_undetermined) {
                    singlePriceUndetermined.checked = true;
                    singlePriceInput.disabled = true;
                    singlePriceInput.value = '';
                    singlePriceInput.style.backgroundColor = '#f3f4f6';
                    singlePriceInput.style.color = '#9ca3af';
                } else {
                    singlePriceUndetermined.checked = false;
                    singlePriceInput.disabled = false;
                    singlePriceInput.value = item.price;
                    singlePriceInput.style.backgroundColor = '';
                    singlePriceInput.style.color = '';
                }
                
                // 🔧 단일 가격 필드에 change 이벤트 리스너 추가
                singlePriceInput.addEventListener('input', function() {
                    console.log('Single price changed:', this.value);
                    // 값이 변경되었음을 표시하기 위해 데이터 속성 추가
                    this.setAttribute('data-changed', 'true');
                });
                
                singlePriceUndetermined.addEventListener('change', function() {
                    console.log('Single price undetermined changed:', this.checked);
                    this.setAttribute('data-changed', 'true');
                });
            }
        } else if (currentMode === 'multiple') {
            // 다중 모드: 모든 아이템을 다중 아이템 리스트에 추가
            itemsList.innerHTML = ''; // 기존 DOM 아이템 제거
            itemCounter = 0;
            
            existingItemPrices.forEach((item, index) => {
                addNewItem(
                    item.item_name || '',
                    item.is_price_undetermined ? '' : item.price.toString(),
                    item.is_price_undetermined,
                    item.id  // ID 추가
                );
            });
        }
    }

    // 다중 가격 모드로 전환
    addItemsBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        
        currentMode = 'multiple';
        singlePriceMode.classList.add('hidden');
        multiplePriceMode.classList.remove('hidden');
        
        // 첫 번째 아이템을 단일 가격에서 복사
        if (itemCounter === 0) {
            addItemFromSinglePrice();
        }
        addNewItem();
        updateFormsetManagement();
    });

    // 단일 가격에서 첫 번째 아이템 생성
    function addItemFromSinglePrice() {
        const singlePriceInput = document.getElementById('single-price-input');
        const singlePriceUndetermined = document.getElementById('single-price-undetermined');
        
        const price = singlePriceInput?.value || '';
        const isUndetermined = singlePriceUndetermined?.checked || false;
        
        addNewItem('', price, isUndetermined);
    }

    // 새 아이템 추가
    addAnotherItemBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (itemCounter < 20) {
            addNewItem();
            updateFormsetManagement();
        }
    });

    // 단일 모드로 돌아가기
    backToSingleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        
        currentMode = 'single';
        singlePriceMode.classList.remove('hidden');
        multiplePriceMode.classList.add('hidden');
        
        // 다중 아이템 모두 제거
        const items = itemsList.querySelectorAll('.item-row');
        items.forEach(item => item.remove());
        itemCounter = 0;
        updateFormsetManagement();
        updateItemCounter();
    });

    // 🔧 새 아이템 추가 함수 (ID 파라미터 추가)
    function addNewItem(itemName = '', price = '', isUndetermined = false, existingId = null) {
        if (itemCounter >= 20) return;

        const template = itemTemplate.content.cloneNode(true);
        const itemRow = template.querySelector('.item-row');
        
        // 번호 업데이트
        const itemNumbers = template.querySelectorAll('.item-number, .item-number-mobile');
        itemNumbers.forEach(el => {
            el.textContent = `덕${itemCounter + 1}`;
        });

        // ModelFormSet 필드명 설정
        const nameInputs = template.querySelectorAll('.item-name-input, .item-name-input-mobile');
        nameInputs.forEach(input => {
            input.name = `item_prices-${itemCounter}-item_name`;
            input.value = itemName;
        });

        const priceInputs = template.querySelectorAll('.item-price-input, .item-price-input-mobile');
        priceInputs.forEach(input => {
            input.name = `item_prices-${itemCounter}-price`;
            input.value = price;
            input.disabled = isUndetermined;
        });

        const undeterminedCheckboxes = template.querySelectorAll('.item-price-undetermined-checkbox, .item-price-undetermined-checkbox-mobile');
        undeterminedCheckboxes.forEach(checkbox => {
            checkbox.name = `item_prices-${itemCounter}-is_price_undetermined`;
            checkbox.checked = isUndetermined;
            
            // 체크박스 이벤트 리스너
            checkbox.addEventListener('change', function() {
                const row = this.closest('.item-row');
                const priceInputsInRow = row.querySelectorAll('.item-price-input, .item-price-input-mobile');
                const otherCheckbox = row.querySelector(
                    this.classList.contains('item-price-undetermined-checkbox') 
                        ? '.item-price-undetermined-checkbox-mobile'
                        : '.item-price-undetermined-checkbox'
                );
                
                // 가격 입력 필드 상태 변경
                priceInputsInRow.forEach(input => {
                    input.disabled = this.checked;
                    if (this.checked) {
                        input.value = '';
                        input.style.backgroundColor = '#f3f4f6';
                        input.style.color = '#9ca3af';
                    } else {
                        input.style.backgroundColor = '';
                        input.style.color = '';
                    }
                });
                
                // 다른 체크박스 동기화 (데스크톱 ↔ 모바일)
                if (otherCheckbox) {
                    otherCheckbox.checked = this.checked;
                }
            });
        });

        // 🔧 ID 필드 추가 (수정 모드에서 기존 ID 유지)
        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.name = `item_prices-${itemCounter}-id`;
        idInput.value = existingId || '';  // 기존 ID가 있으면 설정
        itemRow.appendChild(idInput);

        // 입력 필드 동기화 (데스크톱 ↔ 모바일)
        if (nameInputs.length >= 2) {
            nameInputs[0].addEventListener('input', () => {
                nameInputs[1].value = nameInputs[0].value;
            });
            nameInputs[1].addEventListener('input', () => {
                nameInputs[0].value = nameInputs[1].value;
            });
        }

        if (priceInputs.length >= 2) {
            priceInputs[0].addEventListener('input', () => {
                if (!priceInputs[0].disabled) {
                    priceInputs[1].value = priceInputs[0].value;
                }
            });
            priceInputs[1].addEventListener('input', () => {
                if (!priceInputs[1].disabled) {
                    priceInputs[0].value = priceInputs[1].value;
                }
            });
        }

        // 삭제 버튼 이벤트
        const removeButtons = template.querySelectorAll('.remove-item-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (itemCounter <= 1) {
                    alert('최소 1개의 덕템은 있어야 합니다.');
                    return;
                }
                itemRow.remove();
                updateItemNumbers();
                updateFormsetManagement();
            });
        });

        itemsList.appendChild(itemRow);
        itemCounter++;
        updateItemCounter();
    }

    // 아이템 번호 재정렬
    function updateItemNumbers() {
        const items = itemsList.querySelectorAll('.item-row');
        items.forEach((item, index) => {
            // 번호 업데이트
            const numbers = item.querySelectorAll('.item-number, .item-number-mobile');
            numbers.forEach(el => {
                el.textContent = `덕${index + 1}`;
            });

            // name 속성 업데이트 (ModelFormSet 형식)
            const nameInputs = item.querySelectorAll('.item-name-input, .item-name-input-mobile');
            nameInputs.forEach(input => {
                input.name = `item_prices-${index}-item_name`;
            });

            const priceInputs = item.querySelectorAll('.item-price-input, .item-price-input-mobile');
            priceInputs.forEach(input => {
                input.name = `item_prices-${index}-price`;
            });

            const checkboxes = item.querySelectorAll('.item-price-undetermined-checkbox, .item-price-undetermined-checkbox-mobile');
            checkboxes.forEach(checkbox => {
                checkbox.name = `item_prices-${index}-is_price_undetermined`;
            });

            // ID 필드 업데이트
            const idInput = item.querySelector(`input[name^="item_prices-"][name$="-id"]`);
            if (idInput) {
                idInput.name = `item_prices-${index}-id`;
            }
        });
        
        itemCounter = items.length;
        updateItemCounter();
    }

    // 아이템 카운터 표시 업데이트
    function updateItemCounter() {
        const counterDisplay = document.getElementById('item-counter-display');
        if (counterDisplay) {
            counterDisplay.textContent = `${itemCounter}/20`;
        }

        // 추가 버튼 상태 업데이트
        if (addAnotherItemBtn) {
            if (itemCounter >= 20) {
                addAnotherItemBtn.disabled = true;
                addAnotherItemBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                addAnotherItemBtn.disabled = false;
                addAnotherItemBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    // 🔧 ModelFormSet 관리 폼 데이터 업데이트 (수정 모드 지원)
    function updateFormsetManagement() {
        const form = document.querySelector('form');
        if (!form) return;

        // 다중 모드일 때만 FormSet 관리 필드 업데이트
        if (currentMode === 'multiple') {
            // 기존 아이템 개수 계산 (수정 모드에서)
            const initialFormsCount = existingItemPrices.length;
            
            const managementFields = [
                { name: 'item_prices-TOTAL_FORMS', value: itemCounter.toString() },
                { name: 'item_prices-INITIAL_FORMS', value: initialFormsCount.toString() },  // 🔧 수정
                { name: 'item_prices-MIN_NUM_FORMS', value: '0' },
                { name: 'item_prices-MAX_NUM_FORMS', value: '20' }
            ];

            managementFields.forEach(field => {
                let input = form.querySelector(`input[name="${field.name}"]`);
                if (!input) {
                    input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = field.name;
                    form.appendChild(input);
                }
                input.value = field.value;
            });
        }
    }

    // 단일 가격 가격 미정 체크박스 처리
    const singleUndeterminedCheckbox = document.getElementById('single-price-undetermined');
    const singlePriceInput = document.getElementById('single-price-input');
    
    if (singleUndeterminedCheckbox && singlePriceInput) {
        singleUndeterminedCheckbox.addEventListener('change', function() {
            singlePriceInput.disabled = this.checked;
            if (this.checked) {
                singlePriceInput.value = '';
                singlePriceInput.style.backgroundColor = '#f3f4f6';
                singlePriceInput.style.color = '#9ca3af';
            } else {
                singlePriceInput.style.backgroundColor = '';
                singlePriceInput.style.color = '';
            }
        });

        // 초기 상태 설정
        if (singleUndeterminedCheckbox.checked) {
            singlePriceInput.disabled = true;
            singlePriceInput.style.backgroundColor = '#f3f4f6';
            singlePriceInput.style.color = '#9ca3af';
        }
    }

    // 🔧 폼 제출 시 데이터 전처리 (수정된 버전)
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            console.log('Form submission, current mode:', currentMode);
            
            // 🔧 price_mode 필드를 항상 추가하도록 수정
            let modeInput = form.querySelector('input[name="price_mode"]');
            if (!modeInput) {
                modeInput = document.createElement('input');
                modeInput.type = 'hidden';
                modeInput.name = 'price_mode';
                form.appendChild(modeInput);
            }
            modeInput.value = currentMode;
            console.log('Set price_mode to:', currentMode);

            // 단일 모드인 경우: FormSet 필드 제거하고 단일 가격 데이터만 전송
            if (currentMode === 'single') {
                console.log('Single mode: removing FormSet fields');
                
                // 🔧 FormSet 관련 필드 모두 제거 (management form 포함)
                const formsetFields = form.querySelectorAll('input[name^="item_prices-"], select[name^="item_prices-"], textarea[name^="item_prices-"]');
                console.log(`Removing ${formsetFields.length} FormSet fields`);
                formsetFields.forEach(field => {
                    console.log(`Removing field: ${field.name}`);
                    field.remove();
                });
                
                // 단일 가격 데이터 확인
                const singlePrice = singlePriceInput?.value || '';
                const isUndetermined = singleUndeterminedCheckbox?.checked || false;
                
                console.log('Single price data:', singlePrice, 'Undetermined:', isUndetermined);
                
                // 🔧 값이 변경되었는지 확인
                const priceChanged = singlePriceInput?.getAttribute('data-changed') === 'true';
                const undeterminedChanged = singleUndeterminedCheckbox?.getAttribute('data-changed') === 'true';
                
                console.log('Price changed:', priceChanged, 'Undetermined changed:', undeterminedChanged);
                
                // 변경사항이 있음을 표시하는 hidden field 추가
                if (priceChanged || undeterminedChanged) {
                    const changedInput = document.createElement('input');
                    changedInput.type = 'hidden';
                    changedInput.name = 'price_changed';
                    changedInput.value = 'true';
                    form.appendChild(changedInput);
                    console.log('Added price_changed flag');
                }
                
                // 단일 가격이 입력되었거나 가격 미정이 체크된 경우에만 진행
                if (!singlePrice && !isUndetermined) {
                    e.preventDefault();
                    alert('가격을 입력하거나 "가격 미정"을 선택해주세요.');
                    return false;
                }
            }

            // 다중 모드인 경우: FormSet 데이터 검증 및 정리
            if (currentMode === 'multiple') {
                console.log('Multiple mode: validating FormSet data');
                
                // 🔧 단일 가격 필드 제거 (다중 모드에서는 불필요)
                const singlePriceFields = form.querySelectorAll('input[name="single_price"], input[name="single_price_undetermined"]');
                console.log(`Removing ${singlePriceFields.length} single price fields`);
                singlePriceFields.forEach(field => {
                    console.log(`Removing single price field: ${field.name}`);
                    field.remove();
                });
                
                const items = itemsList.querySelectorAll('.item-row');
                let hasValidItem = false;
                
                items.forEach((item, index) => {
                    const priceInput = item.querySelector('.item-price-input');
                    const checkbox = item.querySelector('.item-price-undetermined-checkbox');
                    const nameInput = item.querySelector('.item-name-input');
                    
                    const price = priceInput?.value || '';
                    const isUndetermined = checkbox?.checked || false;
                    const itemName = nameInput?.value || '';
                    
                    // 유효한 아이템인지 확인
                    if (price || isUndetermined || itemName) {
                        hasValidItem = true;
                        
                        // 가격 미정인 경우 가격 필드를 0으로 설정
                        if (isUndetermined && priceInput) {
                            priceInput.value = '0';
                        }
                        
                        console.log(`Item ${index}: name="${itemName}", price="${price}", undetermined=${isUndetermined}`);
                    }
                });
                
                if (!hasValidItem) {
                    e.preventDefault();
                    alert('최소 1개의 덕템 정보를 입력해주세요.');
                    return false;
                }
                
                // FormSet 관리 필드 최종 업데이트
                updateFormsetManagement();
            }
            
            // 🔧 최종 폼 데이터 로그
            console.log('=== FINAL FORM DATA ===');
            const formData = new FormData(form);
            for (let [key, value] of formData.entries()) {
                if (key.includes('price') || key.includes('item_prices') || key === 'price_mode' || key === 'price_changed') {
                    console.log(`${key}: ${value}`);
                }
            }
        });
    }

    // 🔧 초기화 (기존 데이터 로드)
    console.log('Initializing price handler, mode:', currentMode);
    
    // UI 모드 설정
    if (currentMode === 'multiple') {
        singlePriceMode.classList.add('hidden');
        multiplePriceMode.classList.remove('hidden');
    } else {
        singlePriceMode.classList.remove('hidden');
        multiplePriceMode.classList.add('hidden');
    }
    
    // 기존 데이터로 아이템 초기화
    initializeExistingItems();
    
    // 관리 필드 및 카운터 업데이트
    updateFormsetManagement();
    updateItemCounter();
    
    console.log('Price handler initialized, final mode:', currentMode, 'itemCounter:', itemCounter);
}