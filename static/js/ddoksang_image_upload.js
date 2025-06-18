// ddoksang_image_upload.js - 폼 제출 시 파일 동기화 개선 버전

// 메인 초기화 함수
window.initDdoksangImageUpload = function() {
  if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
    return window.ddoksangImageUploader;
  }

  const uploader = window.setupDdoksangImageUpload({
    fileInputId: "image-upload",
    fileCountId: "file-count", 
    previewContainerId: "image-preview-container",
    previewListId: "image-preview-list",
    formId: "multiStepForm",
    maxFiles: 10,
    maxSizeMB: 5,
    existingImages: [],
    compression: {
      enabled: true,
      maxWidth: 1920,
      maxHeight: 1440,
      quality: 0.85,
      autoCompress: true
    }
  });

  if (uploader && uploader.isInitialized) {
    window.ddoksangImageUploader = uploader;
    return uploader;
  } else {
    return null;
  }
};

window.setupDdoksangImageUpload = function({
  fileInputId = "image-upload",
  fileCountId = "file-count", 
  previewContainerId = "image-preview-container",
  previewListId = "image-preview-list",
  formId = "multiStepForm",
  maxFiles = 10,
  maxSizeMB = 5,
  existingImages = [],
  compression = {
    enabled: true,
    maxWidth: 1920,
    maxHeight: 1440,
    quality: 0.85,
    autoCompress: true
  }
}) {
  if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
    return window.ddoksangImageUploader;
  }

  const fileInput = document.getElementById(fileInputId);
  const fileCount = document.getElementById(fileCountId);
  const previewContainer = document.getElementById(previewContainerId);
  const previewList = document.getElementById(previewListId);
  const form = document.getElementById(formId);

  if (!fileInput || !fileCount || !previewContainer || !previewList) {
    console.error('❌ 필수 DOM 요소를 찾을 수 없습니다:', {
      fileInput: !!fileInput,
      fileCount: !!fileCount,
      previewContainer: !!previewContainer,
      previewList: !!previewList
    });
    return null;
  }

  console.log('🚀 이미지 업로드 모듈 초기화 시작');

  // 기존 이벤트 핸들러 완전 제거
  const newFileInput = fileInput.cloneNode(true);
  fileInput.parentNode.replaceChild(newFileInput, fileInput);
  const cleanFileInput = document.getElementById(fileInputId);

  let selectedFiles = [];
  let fileIdCounter = Date.now();
  let sortableInstance = null;
  let isProcessing = false;

  // ✅ 폼 제출 시 파일 검증 및 디버깅 강화
  let lastFormSubmitFiles = [];

  // 이미지 압축 함수 (기존과 동일)
  function compressImage(file, options = {}) {
    const {
      maxWidth = compression.maxWidth,
      maxHeight = compression.maxHeight,
      quality = compression.quality
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          const { width, height } = calculateOptimalDimensions(
            img.naturalWidth, 
            img.naturalHeight, 
            maxWidth, 
            maxHeight
          );

          canvas.width = width;
          canvas.height = height;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const outputQuality = file.type === 'image/png' ? 1.0 : quality;

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('이미지 압축 실패'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: file.lastModified
            });

            resolve(compressedFile);
          }, outputType, outputQuality);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('이미지 로딩 실패'));
      img.src = URL.createObjectURL(file);
    });
  }

  function calculateOptimalDimensions(origWidth, origHeight, maxWidth, maxHeight) {
    if (origWidth <= maxWidth && origHeight <= maxHeight) {
      return { width: origWidth, height: origHeight };
    }
    const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight);
    return {
      width: Math.round(origWidth * ratio),
      height: Math.round(origHeight * ratio)
    };
  }

  function shouldCompress(file) {
    if (!compression.enabled) return false;
    return file.size > (2 * 1024 * 1024);
  }

  // ✅ 파일 처리 함수 개선 - 메모리 누수 방지
  async function processFiles(files) {
    if (!files || files.length === 0) return [];
    
    const processedFiles = [];
    
    try {
      isProcessing = true;
      updateProcessingUI(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = ((i + 1) / files.length) * 100;
        updateProcessingProgress(progress, `${file.name} 처리 중...`);

        let processedFile = file;

        if (file.type.startsWith('image/') && shouldCompress(file)) {
          try {
            processedFile = await compressImage(file);
            
            const savingsRatio = (file.size - processedFile.size) / file.size;
            if (savingsRatio < 0.1) {
              processedFile = file;
            }
          } catch (error) {
            console.warn('이미지 압축 실패, 원본 사용:', error);
            processedFile = file;
          }
        }

        processedFiles.push(processedFile);
      }

      updateProcessingProgress(100, '완료!');
      return processedFiles;

    } catch (error) {
      console.error('파일 처리 오류:', error);
      showToast('파일 처리 중 오류가 발생했습니다.', 'error');
      return files;
    } finally {
      isProcessing = false;
      setTimeout(() => updateProcessingUI(false), 1000);
    }
  }

  // 처리 UI 함수들 (기존과 동일)
  function updateProcessingUI(show) {
    const progressContainer = document.getElementById('processing-progress') || createProgressContainer();
    if (show) {
      progressContainer.classList.remove('hidden');
      progressContainer.style.display = 'block';
    } else {
      progressContainer.classList.add('hidden');
      progressContainer.style.display = 'none';
    }
  }

  function createProgressContainer() {
    let container = document.getElementById('processing-progress');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'processing-progress';
    container.className = 'hidden mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg';
    container.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-blue-800">이미지 최적화 중...</span>
        <span class="text-sm text-blue-600 progress-text"></span>
      </div>
      <div class="w-full bg-blue-200 rounded-full h-2">
        <div class="progress-bar bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
      </div>
    `;

    previewContainer.parentNode.insertBefore(container, previewContainer);
    return container;
  }

  function updateProcessingProgress(progress, text) {
    const container = document.getElementById('processing-progress');
    if (!container) return;

    const progressBar = container.querySelector('.progress-bar');
    const progressText = container.querySelector('.progress-text');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = text;
  }

  // ✅ 파일 검증 함수 개선
  function validateFiles(files) {
    const errors = [];

    for (const file of files) {
      // 파일 타입 검증
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: 이미지 파일만 업로드할 수 있습니다.`);
        continue;
      }

      // 파일 크기 검증 (압축 고려)
      const maxSize = compression.enabled ? maxSizeMB * 2 * 1024 * 1024 : maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        const maxSizeDisplay = compression.enabled ? maxSizeMB * 2 : maxSizeMB;
        errors.push(`${file.name}: 파일 크기가 ${maxSizeDisplay}MB를 초과합니다.`);
        continue;
      }

      // ✅ 파일 무결성 검증 추가
      if (file.size === 0) {
        errors.push(`${file.name}: 빈 파일입니다.`);
        continue;
      }

      // ✅ 파일명 검증 추가
      if (!file.name || file.name.trim() === '') {
        errors.push('파일명이 올바르지 않습니다.');
        continue;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ✅ 미리보기 업데이트 함수 개선
  function updatePreview() {
    console.log('🔄 미리보기 업데이트:', {
      selectedFilesCount: selectedFiles.length,
      isProcessing: isProcessing
    });

    // 기존 Sortable 정리
    if (sortableInstance) {
      try {
        sortableInstance.destroy();
      } catch (e) {
        console.warn('Sortable 정리 오류:', e);
      }
      sortableInstance = null;
    }

    // 미리보기 초기화
    previewList.innerHTML = "";

    // 선택된 파일들 렌더링
    selectedFiles.forEach((item, index) => {
      const wrapper = createImageWrapper(item, index);
      previewList.appendChild(wrapper);
    });

    // 추가 버튼
    if (selectedFiles.length < maxFiles && !isProcessing) {
      const addWrapper = createAddButton();
      previewList.appendChild(addWrapper);
    }

    // Sortable 초기화
    initSortable();
    updateFileCount();
    updateFormFileInput(); // ✅ 미리보기 업데이트 시마다 폼 입력도 동기화
    previewContainer.classList.remove("hidden");
    
    // 검증 실행
    triggerValidation();
  }

  // 이미지 래퍼 생성 함수들 (기존과 동일하지만 에러 처리 강화)
  function createImageWrapper(item, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "relative w-full aspect-[3/4] cursor-move bg-gray-100 rounded border";
    wrapper.dataset.fileId = item.id;
    wrapper.dataset.index = index;

    const img = document.createElement("img");
    img.className = "rounded border object-cover w-full h-full pointer-events-none";
    img.alt = item.name || `이미지 ${index + 1}`;

    // ✅ 이미지 로딩 에러 처리 강화
    img.onerror = () => {
      console.warn(`이미지 로딩 실패: ${item.name}`);
      img.src = createErrorPlaceholder();
    };

    // 이미지 소스 설정
    if (item.type === "new") {
      if (item.previewUrl) {
        img.src = item.previewUrl;
      } else {
        createImagePreview(item, img);
      }
    } else if (item.type === "existing") {
      img.src = item.url;
    }

    // 배지들 추가
    addBadges(wrapper, item, index);

    // 삭제 버튼
    const closeBtn = createDeleteButton(item.id);
    
    // 드래그 핸들
    const dragHandle = createDragHandle();

    wrapper.appendChild(img);
    wrapper.appendChild(closeBtn);
    wrapper.appendChild(dragHandle);

    return wrapper;
  }

  function createImagePreview(item, img) {
    if (!item.file) {
      console.warn('파일 객체가 없습니다:', item);
      img.src = createErrorPlaceholder();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      item.previewUrl = e.target.result;
      img.src = e.target.result;
    };
    reader.onerror = (e) => {
      console.error('FileReader 오류:', e);
      img.src = createErrorPlaceholder();
    };
    
    try {
      reader.readAsDataURL(item.file);
    } catch (error) {
      console.error('파일 읽기 오류:', error);
      img.src = createErrorPlaceholder();
    }
  }

  function createErrorPlaceholder() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDroZzrk5nlsaDsiJgg7LqY7J6EPC90ZXh0Pjwvc3ZnPg==';
  }

  // 배지, 버튼 생성 함수들 (기존과 동일)
  function addBadges(wrapper, item, index) {
    if (index === 0) {
      const badge = document.createElement("div");
      badge.className = "absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded z-10";
      badge.textContent = "대표";
      wrapper.appendChild(badge);
    }

    if (item.type === "new" && item.compressed) {
      const compressedBadge = document.createElement("div");
      compressedBadge.className = `absolute ${index === 0 ? 'top-6' : 'top-1'} left-1 bg-green-600 text-white text-xs px-1 py-0.5 rounded z-10`;
      compressedBadge.textContent = "최적화";
      wrapper.appendChild(compressedBadge);
    }

    const orderBadge = document.createElement("div");
    orderBadge.className = "absolute top-1 right-8 bg-gray-800 bg-opacity-80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center z-10";
    orderBadge.textContent = index + 1;
    wrapper.appendChild(orderBadge);
  }

  function createDeleteButton(fileId) {
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.innerHTML = "&times;";
    closeBtn.className = `
      absolute top-1 right-1 w-6 h-6 rounded-full
      bg-red-500 bg-opacity-80 flex items-center justify-center
      text-white text-sm hover:bg-opacity-100 z-20
      transition-all duration-200 hover:scale-110
    `;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeImage(fileId);
    });
    return closeBtn;
  }

  function createDragHandle() {
    const dragHandle = document.createElement("div");
    dragHandle.className = "absolute bottom-1 right-1 bg-gray-800 bg-opacity-80 text-white text-xs px-1 py-0.5 rounded z-10 cursor-grab active:cursor-grabbing";
    dragHandle.innerHTML = "⋮⋮";
    dragHandle.style.touchAction = 'none';
    return dragHandle;
  }

  function createAddButton() {
    const addWrapper = document.createElement("div");
    addWrapper.className = "relative w-full aspect-[3/4] border-2 border-dashed border-gray-300 rounded hover:border-gray-400 transition-colors cursor-pointer bg-gray-50 hover:bg-gray-100";
    addWrapper.dataset.addButton = "true";
    
    const addButton = document.createElement("div");
    addButton.className = "absolute inset-0 flex flex-col items-center justify-center text-gray-400 hover:text-gray-600";
    addButton.innerHTML = `
      <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
      </svg>
      <span class="text-xs">이미지 추가</span>
      <span class="text-xs text-gray-400 mt-1">${selectedFiles.length}/${maxFiles}</span>
    `;
    
    addButton.addEventListener("click", () => {
      if (!isProcessing) {
        cleanFileInput.click();
      }
    });
    
    // 드래그 앤 드롭 지원
    addWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      addWrapper.classList.add('border-blue-400', 'bg-blue-50');
    });
    
    addWrapper.addEventListener('dragleave', (e) => {
      e.preventDefault();
      addWrapper.classList.remove('border-blue-400', 'bg-blue-50');
    });
    
    addWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      addWrapper.classList.remove('border-blue-400', 'bg-blue-50');
      
      if (isProcessing) return;
      
      const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      
      if (files.length === 0) {
        showToast('이미지 파일을 드롭해주세요.', 'warning');
        return;
      }
      
      handleFileSelection(files);
    });
    
    addWrapper.appendChild(addButton);
    return addWrapper;
  }

  // ✅ 파일 선택 처리 함수 개선
  function handleFileSelection(newFiles) {
    console.log('📁 파일 선택 처리:', {
      newFilesCount: newFiles.length,
      currentCount: selectedFiles.length,
      maxFiles: maxFiles
    });

    const remainingSlots = maxFiles - selectedFiles.length;
    
    if (newFiles.length > remainingSlots) {
      if (remainingSlots === 0) {
        showToast(`이미 최대 ${maxFiles}장이 선택되었습니다.`, 'warning');
        return;
      } else {
        const canUpload = remainingSlots;
        const confirmMessage = `선택한 ${newFiles.length}장 중 ${canUpload}장만 업로드할 수 있습니다.\n처음 ${canUpload}장을 업로드하시겠습니까?`;
        
        if (!confirm(confirmMessage)) {
          return;
        }
        
        showToast(`${canUpload}장을 업로드합니다.`, 'info');
      }
    }
    
    const filesToAdd = newFiles.slice(0, remainingSlots);
    
    // 파일 검증
    const validation = validateFiles(filesToAdd);
    
    if (!validation.valid) {
      validation.errors.forEach(error => showToast(error, 'warning'));
      return;
    }

    // 비동기 파일 처리
    processFilesAsync(filesToAdd);
  }

  // ✅ Sortable 초기화 개선
  function initSortable() {
    if (selectedFiles.length <= 1 || isProcessing) return;
    if (typeof Sortable === 'undefined') {
      console.warn('Sortable.js가 로드되지 않았습니다');
      return;
    }

    try {
      sortableInstance = new Sortable(previewList, {
        animation: 200,
        filter: '[data-add-button="true"]',
        preventOnFilter: false,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        fallbackTolerance: 3,
        touchStartThreshold: 5,
        handle: '.cursor-move, .cursor-grab',
        
        onEnd: function(evt) {
          const oldIndex = evt.oldIndex;
          const newIndex = evt.newIndex;
          
          if (evt.item.dataset.addButton === "true") return;
          
          if (oldIndex !== newIndex && 
              oldIndex < selectedFiles.length && 
              newIndex < selectedFiles.length) {
            
            console.log('🔄 파일 순서 변경:', { oldIndex, newIndex });
            
            // 배열 순서 변경
            const movedItem = selectedFiles.splice(oldIndex, 1)[0];
            selectedFiles.splice(newIndex, 0, movedItem);
            
            updatePreview();
            updateFormFileInput();
            triggerValidation();
          }
        }
      });
    } catch (error) {
      console.error('Sortable 초기화 오류:', error);
    }
  }

  // ✅ 이미지 제거 함수 개선
  function removeImage(fileId) {
    console.log('🗑️ 이미지 제거 시작:', fileId);
    
    const initialLength = selectedFiles.length;
    
    // 정확한 ID 매칭으로 제거
    selectedFiles = selectedFiles.filter(item => {
      const shouldKeep = item.id !== fileId;
      if (!shouldKeep) {
        // 메모리 정리
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
        console.log('🗑️ 파일 제거됨:', item.name);
      }
      return shouldKeep;
    });
    
    if (selectedFiles.length !== initialLength) {
      console.log('✅ 파일 제거 완료:', {
        이전개수: initialLength,
        현재개수: selectedFiles.length
      });
      
      updatePreview();
      updateFormFileInput();
      
      // 파일 제거 후 검증 실행
      setTimeout(() => {
        triggerValidation();
      }, 100);
    } else {
      console.warn('⚠️ 파일 제거 실패 - 해당 ID를 찾을 수 없음:', fileId);
    }
  }

  function updateFileCount() {
    if (selectedFiles.length === 0) {
      fileCount.textContent = "선택된 파일 없음";
      fileCount.className = "text-sm text-gray-500";
    } else {
      const compressedCount = selectedFiles.filter(f => f.compressed).length;
      let text = `${selectedFiles.length}개 파일 선택됨 (최대 ${maxFiles}장)`;
      
      if (compressedCount > 0) {
        text += ` · ${compressedCount}개 최적화됨`;
      }
      
      fileCount.textContent = text;
      fileCount.className = "text-sm text-gray-700 font-medium";
    }
  }

  // ✅ 폼 파일 입력 업데이트 함수 대폭 개선
  function updateFormFileInput() {
    console.log('🔄 폼 파일 입력 업데이트 시작');
    
    try {
      // 새로운 DataTransfer 객체 생성
      const dt = new DataTransfer();
      
      // 새로운 파일들만 추가 (순서대로)
      const newFiles = selectedFiles
        .filter(f => f.type === "new" && f.file)
        .map(f => f.file);
      
      console.log('📎 추가할 파일들:', {
        총선택파일: selectedFiles.length,
        새파일개수: newFiles.length,
        파일명들: newFiles.map(f => f.name)
      });
      
      // 파일들을 순서대로 DataTransfer에 추가
      newFiles.forEach((file, index) => {
        try {
          dt.items.add(file);
          console.log(`✅ 파일 ${index + 1} 추가됨: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
        } catch (error) {
          console.error(`❌ 파일 ${index + 1} 추가 실패:`, error, file.name);
        }
      });
      
      // File Input에 설정
      cleanFileInput.files = dt.files;
      
      // ✅ 설정 후 검증
      const resultFiles = Array.from(cleanFileInput.files);
      console.log('🎯 최종 폼 파일 상태:', {
        설정된파일개수: resultFiles.length,
        파일명들: resultFiles.map(f => f.name),
        전체크기: resultFiles.reduce((sum, f) => sum + f.size, 0)
      });
      
      // ✅ 전역 상태 저장 (디버깅용)
      lastFormSubmitFiles = resultFiles;
      
      // ✅ 폼 제출 준비 완료 이벤트 발생
      const event = new CustomEvent('filesUpdated', {
        detail: {
          selectedCount: selectedFiles.length,
          formFileCount: resultFiles.length,
          isReady: resultFiles.length > 0
        }
      });
      document.dispatchEvent(event);
      
    } catch (error) {
      console.error('❌ 폼 파일 입력 업데이트 실패:', error);
      showToast('파일 업데이트 중 오류가 발생했습니다.', 'error');
    }
  }

  function triggerValidation() {
    console.log('🎯 검증 트리거:', {
      selectedFiles: selectedFiles.length,
      formFiles: cleanFileInput.files.length
    });

    // 메인 앱의 검증 로직 호출
    if (window.ddoksangApp?.updateNextButtonState) {
      window.ddoksangApp.updateNextButtonState();
    }
    
    // Step 6에서 추가 검증
    const currentStep = window.ddoksangApp?.currentStep || 0;
    
    if (currentStep === 6) {
      const nextBtn = document.getElementById('nextBtn');
      const fileCount = selectedFiles.length;
      
      if (nextBtn) {
        const shouldEnable = fileCount > 0;
        
        if (shouldEnable) {
          nextBtn.disabled = false;
          nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          nextBtn.classList.add('hover:bg-gray-800');
          nextBtn.textContent = '제출하기';
        } else {
          nextBtn.disabled = true;
          nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
          nextBtn.classList.remove('hover:bg-gray-800');
          nextBtn.textContent = '이미지를 업로드해주세요';
        }
      }
    }
  }

  function showToast(message, type = 'info') {
    if (window.DdoksangFormUtils?.showToast) {
      window.DdoksangFormUtils.showToast(message, type);
    } else {
      console.log(`Toast: ${message}`);
    }
  }

  // ✅ 파일 입력 이벤트 핸들러 개선
  function handleFileInput(event) {
    console.log('📂 파일 입력 이벤트:', event.target.files.length);
    
    const newFiles = Array.from(event.target.files);
    
    if (newFiles.length === 0 || isProcessing) {
      return;
    }
    
    // 파일 검증
    const validation = validateFiles(newFiles);
    
    if (!validation.valid) {
      validation.errors.forEach(error => showToast(error, 'warning'));
      event.target.value = '';
      return;
    }
    
    // 남은 슬롯 계산
    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = newFiles.slice(0, remainingSlots);
    
    if (filesToAdd.length < newFiles.length) {
      showToast(`최대 ${maxFiles}개까지만 업로드할 수 있어 ${filesToAdd.length}개만 추가됩니다.`, 'warning');
    }

    // 비동기 파일 처리
    processFilesAsync(filesToAdd).finally(() => {
      // 파일 입력 초기화하지 않음 - 폼 제출 시 필요
      // event.target.value = '';
    });
  }

  // ✅ 비동기 파일 처리 함수 개선
  async function processFilesAsync(filesToAdd) {
    try {
      console.log('⚙️ 파일 처리 시작:', filesToAdd.length);
      
      const processedFiles = await processFiles(filesToAdd);
      
      // 새 파일 객체 생성 - 고유 ID 보장
      const newFileObjects = processedFiles.map((file, index) => {
        const originalFile = filesToAdd[index];
        const wasCompressed = file !== originalFile;
        
        const fileObj = {
          id: `new_${Date.now()}_${fileIdCounter++}_${Math.random().toString(36).substr(2, 9)}`,
          type: "new",
          file: file,
          name: file.name,
          size: file.size,
          previewUrl: null,
          compressed: wasCompressed
        };
        
        console.log('📁 새 파일 객체 생성:', {
          id: fileObj.id,
          name: fileObj.name,
          size: fileObj.size,
          compressed: wasCompressed
        });
        
        return fileObj;
      });
      
      // 기존 배열에 추가
      selectedFiles = [...selectedFiles, ...newFileObjects];
      
      console.log('✅ 파일 추가 완료:', {
        총파일수: selectedFiles.length,
        새추가: newFileObjects.length
      });
      
      updatePreview();
      updateFormFileInput();
      
      // 파일 추가 후 검증 실행
      setTimeout(() => {
        triggerValidation();
      }, 100);
      
    } catch (error) {
      console.error('❌ 파일 처리 오류:', error);
      showToast('파일 처리 중 오류가 발생했습니다.', 'error');
    }
  }

  // ✅ 폼 제출 이벤트 강화
  function setupFormSubmitHandler() {
    if (!form) return;
    
    // 기존 이벤트 제거
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    const cleanForm = document.getElementById(formId);
    
    cleanForm.addEventListener("submit", function(e) {
      console.log('🚀 폼 제출 시작');
      
      // ✅ 제출 직전 파일 동기화 재실행
      updateFormFileInput();
      
      // ✅ 제출 직전 상태 로깅
      const finalFiles = Array.from(cleanFileInput.files);
      console.log('📊 폼 제출 최종 상태:', {
        selectedFiles: selectedFiles.length,
        formFiles: finalFiles.length,
        파일목록: finalFiles.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        }))
      });
      
      // ✅ 파일이 없으면 제출 중단
      if (selectedFiles.length > 0 && finalFiles.length === 0) {
        e.preventDefault();
        console.error('❌ 파일 동기화 실패 - 제출 중단');
        showToast('파일 업로드 오류가 발생했습니다. 페이지를 새로고침 후 다시 시도해주세요.', 'error');
        return false;
      }
      
      // ✅ 기존 이미지 제거 처리
      if (existingImages && existingImages.length > 0) {
        const existingIds = existingImages.map(img => img.id);
        const currentExistingIds = selectedFiles
          .filter(f => f.type === "existing")
          .map(f => f.originalId);
        
        const removedIds = existingIds.filter(id => !currentExistingIds.includes(id));
        
        if (removedIds.length > 0) {
          const removedInput = document.createElement("input");
          removedInput.type = "hidden";
          removedInput.name = "removed_image_ids";
          removedInput.value = removedIds.join(",");
          cleanForm.appendChild(removedInput);
          
          console.log('🗑️ 제거된 기존 이미지 ID들:', removedIds);
        }
      }
      
      console.log('✅ 폼 제출 진행');
    });
  }

  // 이벤트 리스너 등록
  cleanFileInput.addEventListener("change", handleFileInput);
  
  // ✅ 폼 제출 핸들러 설정
  setupFormSubmitHandler();

  // 초기 상태 설정
  if (existingImages && existingImages.length > 0) {
    selectedFiles = existingImages.map((img, index) => ({
      id: `existing_${img.id || fileIdCounter++}`,
      type: "existing",
      originalId: img.id,
      url: img.url,
      name: img.name || `기존 이미지 ${index + 1}`,
      size: img.size || 0,
      compressed: false,
      ...img
    }));
  }

  updatePreview();

  // ✅ API 객체 생성 - 디버깅 기능 강화
  const apiObject = {
    isInitialized: true,
    getFiles: () => selectedFiles.map(f => f.type === "new" ? f.file : f),
    getNewFiles: () => selectedFiles.filter(f => f.type === "new").map(f => f.file),
    getFileCount: () => selectedFiles.length,
    getSelectedFiles: () => [...selectedFiles],
    getFormFileCount: () => cleanFileInput.files.length,
    removeFileById: (fileId) => removeImage(fileId),
    clear: () => {
      selectedFiles.forEach(item => {
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      selectedFiles = [];
      if (sortableInstance) {
        try {
          sortableInstance.destroy();
        } catch (e) {
          console.warn('Sortable 정리 오류:', e);
        }
        sortableInstance = null;
      }
      updatePreview();
      updateFormFileInput();
      triggerValidation();
    },
    refresh: () => {
      updatePreview();
      updateFormFileInput();
    },
    // ✅ 수동 동기화 함수 추가
    syncFormFiles: () => {
      console.log('🔄 수동 파일 동기화 실행');
      updateFormFileInput();
      triggerValidation();
    },
    // ✅ 상태 검증 함수 추가
    validateState: () => {
      const selectedCount = selectedFiles.length;
      const formCount = cleanFileInput.files.length;
      const isValid = selectedCount === 0 || formCount > 0;
      
      console.log('🔍 상태 검증:', {
        selectedFiles: selectedCount,
        formFiles: formCount,
        isValid: isValid,
        차이발생: selectedCount > 0 && formCount === 0
      });
      
      return {
        isValid: isValid,
        selectedCount: selectedCount,
        formCount: formCount,
        needsSync: selectedCount > 0 && formCount === 0
      };
    },
    getCompressionStats: () => ({
      total: selectedFiles.length,
      compressed: selectedFiles.filter(f => f.compressed).length,
      compressionEnabled: compression.enabled
    }),
    debug: () => ({
      selectedFiles: selectedFiles,
      selectedFileNames: selectedFiles.map(f => f.name),
      formFiles: Array.from(cleanFileInput.files).map(f => f.name),
      lastFormSubmitFiles: lastFormSubmitFiles.map(f => f.name),
      fileIdCounter: fileIdCounter,
      hasSortable: !!sortableInstance,
      isProcessing: isProcessing,
      elementsFound: {
        fileInput: !!cleanFileInput,
        fileCount: !!fileCount,
        previewContainer: !!previewContainer,
        previewList: !!previewList,
        form: !!document.getElementById(formId)
      }
    })
  };

  console.log('✅ 이미지 업로드 모듈 초기화 완료');
  return apiObject;
};

// ✅ 정리 함수 개선
window.cleanupImageUploadHandlers = function() {
  console.log('🧹 이미지 업로드 핸들러 정리 시작');
  
  if (window.ddoksangImageUploader) {
    try {
      window.ddoksangImageUploader.clear();
    } catch (e) {
      console.warn('업로더 정리 오류:', e);
    }
    window.ddoksangImageUploader = null;
  }
  
  // Sortable 인스턴스 정리
  const previewList = document.getElementById('image-preview-list');
  if (previewList && previewList.__sortable) {
    try {
      previewList.__sortable.destroy();
    } catch (e) {
      console.warn('Sortable 정리 오류:', e);
    }
  }
  
  console.log('✅ 정리 완료');
};

// ✅ 디버깅 헬퍼 함수 추가
window.debugImageUpload = function() {
  if (!window.ddoksangImageUploader) {
    console.log('❌ 이미지 업로더가 초기화되지 않았습니다');
    return;
  }
  
  const debug = window.ddoksangImageUploader.debug();
  const validation = window.ddoksangImageUploader.validateState();
  
  console.log('🔍 이미지 업로드 디버그 정보:');
  console.log('선택된 파일들:', debug.selectedFileNames);
  console.log('폼 파일들:', debug.formFiles);
  console.log('마지막 제출 파일들:', debug.lastFormSubmitFiles);
  console.log('상태 검증:', validation);
  console.log('전체 디버그:', debug);
  
  if (validation.needsSync) {
    console.warn('⚠️ 동기화 필요 - syncFormFiles() 실행을 권장합니다');
  }
  
  return { debug, validation };
};

// ✅ 강제 동기화 함수 추가
window.forceImageSync = function() {
  if (window.ddoksangImageUploader?.syncFormFiles) {
    console.log('🔄 강제 동기화 실행');
    window.ddoksangImageUploader.syncFormFiles();
    return window.ddoksangImageUploader.validateState();
  } else {
    console.error('❌ 이미지 업로더를 찾을 수 없습니다');
    return null;
  }
};

// 스타일 정의 (기존과 동일)
const imageUploadCSS = `
  .sortable-ghost {
    opacity: 0.5;
    background: #f3f4f6;
  }
  
  .sortable-chosen {
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    z-index: 999;
  }
  
  .sortable-drag {
    opacity: 0.8;
    transform: rotate(2deg);
  }
  
  #processing-progress {
    transition: all 0.3s ease;
  }
  
  #processing-progress .progress-bar {
    transition: width 0.3s ease;
  }
  
  @media (max-width: 768px) {
    .cursor-move, .cursor-grab {
      cursor: grab;
      touch-action: none;
    }
    
    .cursor-move:active, .cursor-grab:active {
      cursor: grabbing;
    }
    
    .sortable-chosen {
      transform: scale(1.1);
    }
    
    #processing-progress {
      padding: 0.75rem;
      margin-bottom: 1rem;
    }
  }
  
  .cursor-grab:hover {
    background-color: rgba(0, 0, 0, 0.9) !important;
    transform: scale(1.1);
  }
  
  img[src=""] {
    background: linear-gradient(45deg, #f3f4f6 25%, transparent 25%), 
                linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), 
                linear-gradient(45deg, transparent 75%, #f3f4f6 75%), 
                linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
    background-size: 20px 20px;
    background-position: 0;
  }
`;

// 스타일 주입
if (!document.getElementById('ddoksang-image-upload-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'ddoksang-image-upload-styles';
  styleElement.textContent = imageUploadCSS;
  document.head.appendChild(styleElement);
}

// ddoksang_create.js에 추가할 강화된 폼 제출 로직

// ✅ 강화된 제출 확인 모달
function showSubmitConfirmModal() {
    // 제출 전 이미지 상태 최종 검증
    let imageWarning = '';
    if (window.ddoksangImageUploader) {
        const validation = window.ddoksangImageUploader.validateState();
        const selectedCount = validation.selectedCount;
        const formCount = validation.formCount;
        
        console.log('🏁 제출 전 최종 이미지 검증:', validation);
        
        if (selectedCount > 0 && formCount === 0) {
            console.error('❌ 심각한 동기화 문제 발견!');
            FormUtils.showToast('이미지 업로드에 문제가 있습니다. 페이지를 새로고침하고 다시 시도해주세요.', 'error');
            return;
        }
        
        if (selectedCount === 0) {
            imageWarning = '<p class="text-orange-600 text-sm mt-2">⚠️ 이미지가 첨부되지 않았습니다.</p>';
        } else {
            imageWarning = `<p class="text-green-600 text-sm mt-2">✅ 이미지 ${selectedCount}장이 첨부됩니다.</p>`;
        }
    }
    
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
                    <p class="text-gray-600 mb-2">모든 내용을 확인하셨나요?</p>
                    ${imageWarning}
                    <p class="text-gray-600 mb-6 mt-4">등록하시겠습니까?</p>
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
        executeFormSubmit();
    });
    document.addEventListener('keydown', handleModalEscape);
}

// ✅ 실제 폼 제출 실행 함수
function executeFormSubmit() {
    console.log('🚀 폼 제출 실행 시작');
    
    const form = document.getElementById("multiStepForm");
    if (!form) {
        console.error('❌ 폼을 찾을 수 없습니다');
        FormUtils.showToast('폼을 찾을 수 없습니다.', 'error');
        return;
    }
    
    try {
        // ✅ 제출 직전 이미지 동기화 재실행
        if (window.ddoksangImageUploader?.syncFormFiles) {
            console.log('🔄 제출 직전 이미지 동기화 실행');
            window.ddoksangImageUploader.syncFormFiles();
            
            // 동기화 후 상태 재검증
            const validation = window.ddoksangImageUploader.validateState();
            console.log('📊 동기화 후 검증 결과:', validation);
            
            if (validation.selectedCount > 0 && validation.formCount === 0) {
                console.error('❌ 동기화 후에도 문제 지속');
                FormUtils.showToast('이미지 업로드 오류가 발생했습니다. 다시 시도해주세요.', 'error');
                return;
            }
        }
        
        // ✅ 제출 전 로딩 상태 표시
        const submitLoadingHTML = `
            <div id="submitLoading" class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
                <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4 text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <h3 class="text-lg font-semibold mb-2">등록 중...</h3>
                    <p class="text-gray-600 text-sm">잠시만 기다려주세요.</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', submitLoadingHTML);
        
        // ✅ 폼 제출 실행
        console.log('📤 폼 제출 실행');
        form.submit();
        
    } catch (error) {
        console.error('❌ 폼 제출 오류:', error);
        FormUtils.showToast('제출 중 오류가 발생했습니다.', 'error');
        
        // 로딩 상태 제거
        const loading = document.getElementById('submitLoading');
        if (loading) {
            loading.remove();
        }
    }
}

// ✅ 초기화 함수에서 폼 제출 핸들러 개선
function initializeFormSubmit() {
    const form = document.getElementById('multiStepForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        console.log('📨 폼 제출 이벤트 감지');
        
        // ✅ 제출 직전 최종 검증
        if (window.ddoksangImageUploader) {
            const validation = window.ddoksangImageUploader.validateState();
            console.log('📋 제출 직전 검증:', validation);
            
            // 이미지 동기화 문제가 있으면 수정 시도
            if (validation.needsSync) {
                console.log('🔧 제출 직전 동기화 실행');
                window.ddoksangImageUploader.syncFormFiles();
            }
        }
        
        // ✅ 모든 입력 필드 활성화 (disabled 해제)
        this.querySelectorAll('input, textarea, select').forEach(input => {
            input.disabled = false;
        });

        // ✅ X(트위터) 소스 URL 처리
        const xUsername = FormUtils.getValue('x_username');
        if (xUsername) {
            const xInput = document.createElement('input');
            xInput.type = 'hidden';
            xInput.name = 'x_source';
            xInput.value = `https://x.com/${xUsername.replace('@', '')}`;
            this.appendChild(xInput);
        }
        
        console.log('✅ 폼 제출 사전 처리 완료');
    });
}

// ✅ 페이지 이탈 방지 (작성 중인 내용 보호)
function setupBeforeUnload() {
    let formModified = false;
    
    // 폼 변경 감지
    document.addEventListener('input', function(e) {
        if (e.target.closest('#multiStepForm')) {
            formModified = true;
        }
    });
    
    // 이미지 업로드 시에도 변경으로 간주
    document.addEventListener('filesUpdated', function() {
        formModified = true;
    });
    
    // 페이지 이탈 시 경고
    window.addEventListener('beforeunload', function(e) {
        if (formModified && currentStep > 0) {
            const message = '작성 중인 내용이 있습니다. 페이지를 떠나시겠습니까?';
            e.returnValue = message;
            return message;
        }
    });
    
    // 폼 제출 시에는 경고 해제
    document.addEventListener('submit', function() {
        formModified = false;
    });
}

// ✅ Step 6에서 이미지 상태 실시간 모니터링
function monitorStep6Images() {
    if (currentStep !== 6) return;
    
    const monitor = setInterval(() => {
        if (currentStep !== 6) {
            clearInterval(monitor);
            return;
        }
        
        if (window.ddoksangImageUploader) {
            const validation = window.ddoksangImageUploader.validateState();
            
            // 동기화 문제 발견시 자동 수정
            if (validation.needsSync) {
                console.warn('⚠️ Step 6에서 동기화 문제 감지 - 자동 수정');
                window.ddoksangImageUploader.syncFormFiles();
            }
        }
    }, 2000); // 2초마다 체크
    
    // 5분 후 모니터링 종료
    setTimeout(() => {
        clearInterval(monitor);
    }, 300000);
}

// ✅ moveStep 함수에서 Step 6 진입 시 모니터링 시작
// 기존 moveStep 함수에 다음 코드 추가:
/*
if (direction === 1 && currentStep + direction === 6) {
    setTimeout(() => {
        monitorStep6Images();
    }, 1000);
}
*/