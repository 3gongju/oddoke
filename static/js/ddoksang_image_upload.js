// ddoksang 생카 등록용 간단한 이미지 업로드 (기존 어덕해 방식)

window.setupDdoksangImageUpload = function({
  fileInputId = "image-upload",
  fileCountId = "file-count", 
  previewContainerId = "image-preview-container",
  previewListId = "image-preview-list",
  formId = "multiStepForm",
  maxFiles = 10,
  maxSizeMB = 5,
  existingImages = []
}) {
  const fileInput = document.getElementById(fileInputId);
  const fileCount = document.getElementById(fileCountId);
  const previewContainer = document.getElementById(previewContainerId);
  const previewList = document.getElementById(previewListId);
  const form = document.getElementById(formId);

  if (!fileInput || !fileCount || !previewContainer || !previewList) {
    console.warn('이미지 업로드: 필수 요소를 찾을 수 없습니다.');
    return null;
  }

  // 기존 이미지도 selectedFiles에 초기값으로 담아두기
  let selectedFiles = existingImages.length
    ? existingImages.map(img => ({ type: "existing", ...img }))
    : [];

  // Sortable 인스턴스 저장용
  let sortableInstance = null;

  // 미리보기 업데이트
  function updatePreview() {
    // 기존 미리보기를 초기화
    previewList.innerHTML = "";

    // 선택된 이미지들 렌더링
    selectedFiles.forEach((item, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative w-full aspect-[3/4] cursor-move";
      wrapper.dataset.index = index;
      wrapper.draggable = true;

      const img = document.createElement("img");
      img.className = "rounded border object-cover w-full h-full pointer-events-none";

      if (item.type === "new") {
        // 새로 업로드된 이미지 파일은 FileReader로 읽어서 미리보기
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(item.file);
      } else if (item.type === "existing") {
        // 기존 이미지 URL 사용
        img.src = item.url;
      }

      // 대표 이미지 표시 (첫 번째만)
      if (index === 0) {
        const badge = document.createElement("div");
        badge.className = "absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded z-10";
        badge.textContent = "대표";
        wrapper.appendChild(badge);
      }

      // 순서 번호 표시
      const orderBadge = document.createElement("div");
      orderBadge.className = "absolute top-1 right-8 bg-gray-800 bg-opacity-80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center z-10";
      orderBadge.textContent = index + 1;
      wrapper.appendChild(orderBadge);

      // 삭제 버튼
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.innerHTML = "&times;";
      closeBtn.className = `
        absolute top-1 right-1 w-6 h-6 rounded-full
        bg-red-500 bg-opacity-80 flex items-center justify-center
        text-white text-sm hover:bg-opacity-100 z-10
      `;
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedFiles.splice(index, 1);
        updatePreview();
        updateFormFileInput();
        
        // 폼 검증 트리거
        if (window.ddoksangApp && window.ddoksangApp.updateNextButtonState) {
          window.ddoksangApp.updateNextButtonState();
        }
      });

      // 드래그 핸들 표시
      const dragHandle = document.createElement("div");
      dragHandle.className = "absolute bottom-1 right-1 bg-gray-800 bg-opacity-80 text-white text-xs px-1 py-0.5 rounded z-10";
      dragHandle.innerHTML = "⋮⋮";
      wrapper.appendChild(dragHandle);

      wrapper.appendChild(img);
      wrapper.appendChild(closeBtn);
      previewList.appendChild(wrapper);
    });

    // 더 많은 이미지 추가할 수 있으면 "+" 버튼 추가
    if (selectedFiles.length < maxFiles) {
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
      `;
      
      addButton.addEventListener("click", () => {
        fileInput.click();
      });
      
      addWrapper.appendChild(addButton);
      previewList.appendChild(addWrapper);
    }

    // Sortable 초기화 (기존 인스턴스가 있으면 제거 후 재생성)
    if (sortableInstance) {
      sortableInstance.destroy();
    }

    if (selectedFiles.length > 1 && window.Sortable) {
      sortableInstance = new Sortable(previewList, {
        animation: 150,
        filter: '[data-add-button="true"]',
        onEnd: function(evt) {
          const oldIndex = evt.oldIndex;
          const newIndex = evt.newIndex;
          
          if (oldIndex !== newIndex && oldIndex < selectedFiles.length && newIndex < selectedFiles.length) {
            const movedItem = selectedFiles.splice(oldIndex, 1)[0];
            selectedFiles.splice(newIndex, 0, movedItem);
            
            console.log(`이미지 순서 변경: ${oldIndex} → ${newIndex}`);
            
            updatePreview();
            updateFormFileInput();
            
            if (window.ddoksangApp && window.ddoksangApp.updateNextButtonState) {
              window.ddoksangApp.updateNextButtonState();
            }
          }
        }
      });
      
      console.log('🔄 Sortable 초기화 완료');
    }

    // 파일 개수 표시
    if (selectedFiles.length === 0) {
      fileCount.textContent = "선택된 파일 없음";
      fileCount.className = "text-sm text-gray-500";
    } else {
      fileCount.textContent = `${selectedFiles.length}개 파일 선택됨 (최대 ${maxFiles}장)`;
      fileCount.className = "text-sm text-gray-700 font-medium";
    }

    // 미리보기 컨테이너 항상 표시
    previewContainer.classList.remove("hidden");
  }

  // 폼의 파일 input 업데이트 (새 파일만)
  function updateFormFileInput() {
    const dt = new DataTransfer();
    selectedFiles
      .filter(f => f.type === "new")
      .forEach(f => dt.items.add(f.file));
    fileInput.files = dt.files;
    
    // Step 6 검증을 위해 파일이 있으면 더미 파일도 추가
    if (selectedFiles.length > 0 && dt.files.length === 0) {
      // 기존 이미지만 있는 경우 더미 파일 추가
      for (let i = 0; i < selectedFiles.length; i++) {
        const dummyFile = new File(['dummy'], `existing_image_${i}.jpg`, { type: 'image/jpeg' });
        dt.items.add(dummyFile);
      }
      fileInput.files = dt.files;
    }
  }

  // 파일 검증
  function validateFiles(files) {
    const errors = [];
    
    if (selectedFiles.length + files.length > maxFiles) {
      errors.push(`최대 ${maxFiles}개의 이미지만 업로드할 수 있습니다.`);
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: 이미지 파일만 업로드할 수 있습니다.`);
        continue;
      }

      const maxSize = maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        errors.push(`${file.name}: 파일 크기가 ${maxSizeMB}MB를 초과합니다.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 파일 input 이벤트 리스너
  fileInput.addEventListener("change", function () {
    const newFiles = Array.from(this.files);
    
    if (newFiles.length === 0) return;
    
    const validation = validateFiles(newFiles);
    
    if (!validation.valid) {
      if (window.DdoksangFormUtils && window.DdoksangFormUtils.showToast) {
        validation.errors.forEach(error => {
          window.DdoksangFormUtils.showToast(error, 'warning');
        });
      } else {
        alert(validation.errors.join('\n'));
      }
      return;
    }
    
    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = newFiles.slice(0, remainingSlots);
    
    const newFileObjects = filesToAdd.map(file => ({ type: "new", file }));
    selectedFiles = selectedFiles.concat(newFileObjects);
    
    updatePreview();
    updateFormFileInput();
    
    if (window.ddoksangApp && window.ddoksangApp.updateNextButtonState) {
      window.ddoksangApp.updateNextButtonState();
    }
  });

  // 폼 제출 시 처리
  if (form) {
    form.addEventListener("submit", function () {
      if (existingImages.length) {
        const removedIds = existingImages
          .filter(img => !selectedFiles.find(f => f.type === "existing" && f.id === img.id))
          .map(img => img.id);

        if (removedIds.length > 0) {
          const removedInput = document.createElement("input");
          removedInput.type = "hidden";
          removedInput.name = "removed_image_ids";
          removedInput.value = removedIds.join(",");
          form.appendChild(removedInput);
        }
      }

      updateFormFileInput();
    });
  }

  // 초기 상태 설정
  updatePreview();

  // 외부에서 사용할 수 있는 API 반환
  return {
    getFiles: () => selectedFiles.map(f => f.type === "new" ? f.file : f),
    getNewFiles: () => selectedFiles.filter(f => f.type === "new").map(f => f.file),
    getFileCount: () => selectedFiles.length,
    getFilesOrder: () => selectedFiles.map((f, index) => ({ ...f, order: index })),
    clear: () => {
      selectedFiles = [];
      if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
      }
      updatePreview();
      updateFormFileInput();
    },
    refresh: () => {
      updatePreview();
      updateFormFileInput();
    }
  };
};

// 자동 초기화 함수
function autoInitImageUpload() {
  console.log('🖼️ 이미지 업로드 자동 초기화 시도...');
  
  const fileInput = document.getElementById('image-upload');
  const fileCount = document.getElementById('file-count');
  const previewContainer = document.getElementById('image-preview-container');
  const previewList = document.getElementById('image-preview-list');
  
  if (fileInput && fileCount && previewContainer && previewList && !window.ddoksangImageUploader) {
    console.log('🚀 이미지 업로드 초기화 실행');
    
    window.ddoksangImageUploader = window.setupDdoksangImageUpload({
      fileInputId: "image-upload",
      fileCountId: "file-count", 
      previewContainerId: "image-preview-container",
      previewListId: "image-preview-list",
      formId: "multiStepForm",
      maxFiles: 10,
      maxSizeMB: 5
    });
    
    console.log('✅ 이미지 업로드 초기화 완료:', !!window.ddoksangImageUploader);
    return true;
  }
  
  console.log('⏳ 초기화 조건 미충족');
  return false;
}

// DOMContentLoaded에서 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 ddoksang_image_upload.js DOM 로드됨');
  
  autoInitImageUpload();
  
  setTimeout(() => {
    if (!window.ddoksangImageUploader) {
      console.log('🔄 1초 후 재시도...');
      autoInitImageUpload();
    }
  }, 1000);
  
  setTimeout(() => {
    if (!window.ddoksangImageUploader) {
      console.log('🔄 3초 후 마지막 시도...');
      autoInitImageUpload();
    }
  }, 3000);
});

// 전역에서 수동 초기화 가능하도록
window.initDdoksangImageUpload = autoInitImageUpload;