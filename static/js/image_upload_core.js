// image_upload_core.js
export function setupImageUploadCore({
  existingImages = [],
  formId = "create-form",
  removedInputName = "removed_image_ids"
}) {
  const fileInput = document.getElementById("image-upload");
  const fileCount = document.getElementById("file-count");
  const previewContainer = document.getElementById("image-preview-container");
  const previewList = document.getElementById("image-preview-list");
  const originalImageSection = document.getElementById("original-image");
  const form = document.getElementById(formId);

  if (!fileInput || !previewContainer || !previewList || !form) return;

  let selectedFiles = existingImages.length
    ? existingImages.map(img => ({ type: "existing", ...img }))
    : [];

  function updatePreview() {
    previewList.innerHTML = "";

    selectedFiles.forEach((item, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative w-full aspect-square";
      wrapper.dataset.index = index;

      const img = document.createElement("img");
      img.className = "rounded border object-cover w-full h-full";
      if (item.type === "new") {
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(item.file);
      } else {
        img.src = item.url;
      }

      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = "&times;";
      closeBtn.className = `
        absolute top-1 right-1 w-6 h-6 rounded-full
        bg-black bg-opacity-60 flex items-center justify-center
        text-white text-sm hover:bg-opacity-80
      `;
      closeBtn.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        updatePreview();
      });

      wrapper.appendChild(img);
      wrapper.appendChild(closeBtn);
      previewList.appendChild(wrapper);
    });

    if (selectedFiles.length < 10) {
      const addBox = document.createElement("div");
      addBox.className = `
        flex items-center justify-center bg-gray-100 hover:bg-gray-200
        rounded border border-gray-300 aspect-square w-full relative
        order-last cursor-pointer
      `;
      addBox.innerHTML = '<span class="text-3xl text-gray-400">+</span>';
      addBox.addEventListener("click", () => fileInput.click());
      previewList.appendChild(addBox);
    }

    fileCount.textContent = selectedFiles.length > 0
      ? `${selectedFiles.length}개 파일 선택됨 (최대 10장)`
      : "선택된 파일 없음";

    previewContainer.classList.toggle("hidden", selectedFiles.length === 0);
    if (originalImageSection) {
      originalImageSection.classList.toggle("hidden", selectedFiles.length > 0);
    }
  }

  new Sortable(previewList, {
    animation: 150,
    onEnd: () => {
      const newOrder = Array.from(previewList.children)
        .filter(el => el.querySelector("img"))
        .map(el => selectedFiles[parseInt(el.dataset.index, 10)]);
      selectedFiles = newOrder;
      updatePreview();
    }
  });

  fileInput.addEventListener("change", function () {
    const newFiles = Array.from(this.files).map(file => ({ type: "new", file }));
    if (selectedFiles.length + newFiles.length > 10) {
      alert("최대 10장까지만 업로드할 수 있습니다.");
      return;
    }
    selectedFiles = selectedFiles.concat(newFiles);
    updatePreview();
  });

  form.addEventListener("submit", function () {
    if (existingImages.length) {
      const removedIds = existingImages
        .filter(img => !selectedFiles.find(f => f.type === "existing" && f.id === img.id))
        .map(img => img.id);

      if (removedIds.length > 0) {
        const removedInput = document.createElement("input");
        removedInput.type = "hidden";
        removedInput.name = removedInputName;
        removedInput.value = removedIds.join(",");
        form.appendChild(removedInput);
      }
    }

    const dt = new DataTransfer();
    selectedFiles
      .filter(f => f.type === "new")
      .forEach(f => dt.items.add(f.file));
    fileInput.files = dt.files;
  });

  updatePreview();
}
