// ddoksang 생카 등록용 이미지 업로드 모듈

export function setupDdoksangImageUpload({
  fileInputId = "image-upload",
  fileCountId = "file-count", 
  previewContainerId = "image-preview-container",
  previewListId = "image-preview-list",
  formId = "multiStepForm",
  maxFiles = 10,
  maxSizeMB = 5
}) {
  const fileInput = document.getElementById(fileInputId);
  const fileCount = document.getElementById(fileCountId);
  const previewContainer = document.getElementById(previewContainerId);
  const previewList = document.getElementById(previewListId);
  const form = document.getElementById(formId);

  if (!fileInput || !previewContainer || !previewList || !form) {
    console.warn('이미지 업로드: 필수 요소를 찾을 수 없습니다.');
    return;
  }

  // 선택된 파일들을 관리하는 배열
  let selectedFiles = [];

  // Sortable.js가 있다면 드래그 앤 드롭 정렬 활성화
  if (typeof Sortable !== 'undefined') {
    new Sortable(previewList, {
      animation: 150,
      onEnd: () => {
        // 드래그 앤 드롭으로 순서를 바꾼 경우, selectedFiles 순서 재정렬
        const newOrder = Array.from(previewList.children)
          .filter(el => el.dataset.fileIndex !== undefined)
          .map(el => selectedFiles[parseInt(el.dataset.fileIndex, 10)]);
        selectedFiles = newOrder;
        updatePreview();
      }
    });
  }

  // 미리보기 업데이트
  function updatePreview() {
    previewList.innerHTML = "";

    // 선택된 이미지들 렌더링
    selectedFiles.forEach((file, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative w-full aspect-square";
      wrapper.dataset.fileIndex = index;

      const img = document.createElement("img");
      img.className = "rounded border object-cover w-full h-full";

      // FileReader로 읽어서 미리보기
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(file);

      // 대표 이미지 표시 (첫 번째 이미지)
      const badge = document.createElement("div");
      badge.className = "absolute top-2 left-2 bg-gray-900 text-white text-xs px-2 py-1 rounded";
      badge.textContent = index === 0 ? "대표" : `${index + 1}`;

      // 삭제 버튼
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.innerHTML = "&times;";
      closeBtn.className = `
        absolute top-1 right-1 w-6 h-6 rounded-full
        bg-red-500 hover:bg-red-600 text-white text-sm
        flex items-center justify-center transition-colors
      `;
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        removeFile(index);
      });

      wrapper.appendChild(img);
      wrapper.appendChild(badge);
      wrapper.appendChild(closeBtn);
      previewList.appendChild(wrapper);
    });

    // ➕ 새 이미지 추가 버튼 (최대 개수 미만일 때만)
    if (selectedFiles.length < maxFiles) {
      const addBox = document.createElement("div");
      addBox.className = `
        flex items-center justify-center bg-gray-100 hover:bg-gray-200
        rounded border border-gray-300 aspect-square w-full
        cursor-pointer transition-colors
      `;
      addBox.innerHTML = '<span class="text-3xl text-gray-400">+</span>';
      addBox.addEventListener("click", () => fileInput.click());
      previewList.appendChild(addBox);
    }

    // 파일 개수 및 상태 표시
    updateFileCount();

    // 미리보기 컨테이너 표시/숨김
    previewContainer.classList.toggle("hidden", selectedFiles.length === 0);

    // 폼의 file input 업데이트
    updateFormFileInput();
  }

  // 파일 개수 표시 업데이트
  function updateFileCount() {
    if (selectedFiles.length === 0) {
      fileCount.textContent = "선택된 파일 없음";
      fileCount.className = "text-sm text-gray-500";
    } else {
      fileCount.textContent = `${selectedFiles.length}개 파일 선택됨 (최대 ${maxFiles}장)`;
      fileCount.className = "text-sm text-gray-700 font-medium";
    }
  }

  // 파일 제거
  function removeFile(index) {
    selectedFiles.splice(index, 1);
    updatePreview();
    
    // 폼 검증 트리거 (ddoksang_create.js의 updateNextButtonState 호출)
    if (window.ddoksangApp && window.ddoksangApp.updateNextButtonState) {
      window.ddoksangApp.updateNextButtonState();
    }
  }

  // 폼의 파일 input 업데이트
  function updateFormFileInput() {
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
  }

  // 파일 검증
  function validateFiles(files) {
    const errors = [];
    
    // 개수 검증
    if (selectedFiles.length + files.length > maxFiles) {
      errors.push(`최대 ${maxFiles}개의 이미지만 업로드할 수 있습니다.`);
    }

    // 각 파일 검증
    for (const file of files) {
      // 파일 타입 검증
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: 이미지 파일만 업로드할 수 있습니다.`);
        continue;
      }

      // 파일 크기 검증
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

  // 새 파일 추가
  function addFiles(files) {
    const validation = validateFiles(files);
    
    if (!validation.valid) {
      // 토스트 메시지 표시
      if (window.DdoksangFormUtils && window.DdoksangFormUtils.showToast) {
        validation.errors.forEach(error => {
          window.DdoksangFormUtils.showToast(error, 'warning');
        });
      } else {
        alert(validation.errors.join('\n'));
      }
      return false;
    }

    // 파일 추가
    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    selectedFiles = selectedFiles.concat(filesToAdd);
    
    updatePreview();
    
    // 폼 검증 트리거
    if (window.ddoksangApp && window.ddoksangApp.updateNextButtonState) {
      window.ddoksangApp.updateNextButtonState();
    }
    
    return true;
  }

  // 파일 input 이벤트 리스너
  fileInput.addEventListener("change", function(e) {
    if (this.files.length > 0) {
      addFiles(this.files);
    }
  });

  // 드래그 앤 드롭 설정
  setupDragAndDrop();

  function setupDragAndDrop() {
    const uploadArea = document.getElementById('image-upload-area');
    if (!uploadArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, unhighlight, false);
    });

    uploadArea.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function highlight(e) {
      uploadArea.classList.add('border-gray-400', 'bg-gray-50');
    }

    function unhighlight(e) {
      uploadArea.classList.remove('border-gray-400', 'bg-gray-50');
    }

    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = Array.from(dt.files).filter(file => file.type.startsWith('image/'));
      
      if (files.length > 0) {
        addFiles(files);
      }
    }
  }

  // 초기 상태 설정
  updatePreview();

  // 외부에서 사용할 수 있는 API 반환
  return {
    addFiles,
    removeFile,
    getFiles: () => [...selectedFiles],
    getFileCount: () => selectedFiles.length,
    clear: () => {
      selectedFiles = [];
      updatePreview();
    }
  };
}