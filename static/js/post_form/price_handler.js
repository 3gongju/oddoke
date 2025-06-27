// static/js/post_form/price_handler.js
// 가격 입력 관련 JavaScript 로직 (ModelFormSet 방식)

export function setupPriceHandlers() {
    const singlePriceMode = document.getElementById('single-price-mode');
    const multiplePriceMode = document.getElementById('multiple-items-mode');
    const addItemsBtn = document.getElementById('add-items-btn');
    const addAnotherItemBtn = document.getElementById('add-another-item-btn');
    const backToSingleBtn = document.getElementById('back-to-single-btn');
    const itemsList = document.getElementById('items-list');
    const itemTemplate = document.getElementById('item-template');

    if (!singlePriceMode || !multiplePriceMode) return;

    let itemCounter = getInitialItemCount();

    // 초기 아이템 개수 확인 (수정 모드에서)
    function getInitialItemCount() {
        const existingItems = itemsList.querySelectorAll('.item-row');
        return existingItems.length;
    }

    // 다중 가격 모드로 전환
    addItemsBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        
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
        
        if (confirm('다중 가격 설정 내용이 모두 삭제됩니다. 계속하시겠습니까?')) {
            singlePriceMode.classList.remove('hidden');
            multiplePriceMode.classList.add('hidden');
            
            // 다중 아이템 모두 제거
            const items = itemsList.querySelectorAll('.item-row');
            items.forEach(item => item.remove());
            itemCounter = 0;
            updateFormsetManagement();
            updateItemCounter();
        }
    });

    // 새 아이템 추가 함수
    function addNewItem(itemName = '', price = '', isUndetermined = false) {
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
            
            // 🔧 체크박스 이벤트 리스너 (Django 호환 값 처리)
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
                
                // 🔧 Django 호환 값 설정
                this.value = this.checked ? 'on' : '';
            });
        });

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

    // ModelFormSet 관리 폼 데이터 업데이트
    function updateFormsetManagement() {
        const form = document.querySelector('form');
        if (!form) return;

        // ModelFormSet 관리 필드 추가/업데이트
        const managementFields = [
            { name: 'item_prices-TOTAL_FORMS', value: itemCounter.toString() },
            { name: 'item_prices-INITIAL_FORMS', value: '0' },
            { name: 'item_prices-MIN_NUM_FORMS', value: '1' },
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

    // 🔧 폼 제출 시 데이터 전처리
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            // 다중 모드인 경우
            if (!multiplePriceMode.classList.contains('hidden')) {
                // 다중 모드: 체크박스 값 보정
                const items = itemsList.querySelectorAll('.item-row');
                items.forEach((item, index) => {
                    const checkbox = item.querySelector('.item-price-undetermined-checkbox');
                    if (checkbox) {
                        // Django 호환 값 설정
                        checkbox.value = checkbox.checked ? 'on' : '';
                        
                        // 가격 미정인 경우 가격 필드 비우기
                        if (checkbox.checked) {
                            const priceInput = item.querySelector('.item-price-input');
                            if (priceInput) {
                                priceInput.value = '';
                            }
                        }
                    }
                });
                return; // 다중 모드는 추가 처리 불필요
            }

            // 단일 모드: FormSet 형식으로 변환
            const singlePrice = singlePriceInput?.value || '';
            const isUndetermined = singleUndeterminedCheckbox?.checked || false;

            // 기존 FormSet 필드 제거
            const existingFields = form.querySelectorAll('input[name^="item_prices-"]');
            existingFields.forEach(field => field.remove());

            // 새로운 FormSet 데이터 생성
            const managementFields = [
                { name: 'item_prices-TOTAL_FORMS', value: '1' },
                { name: 'item_prices-INITIAL_FORMS', value: '0' },
                { name: 'item_prices-MIN_NUM_FORMS', value: '1' },
                { name: 'item_prices-MAX_NUM_FORMS', value: '20' },
                { name: 'item_prices-0-item_name', value: '' },
                { name: 'item_prices-0-price', value: isUndetermined ? '0' : singlePrice },
                { name: 'item_prices-0-is_price_undetermined', value: isUndetermined ? 'on' : '' }
            ];

            managementFields.forEach(field => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = field.name;
                input.value = field.value;
                form.appendChild(input);
            });
        });
    }

    // 초기화
    updateFormsetManagement();
    updateItemCounter();
}