document.addEventListener("DOMContentLoaded", () => {
  const faqButton = document.getElementById('faqButton');
  const faqModal = document.getElementById('faqModal');
  const faqContainer = document.getElementById('faqContainer');
  const closeModal = document.getElementById('closeModal');
  const questionSection = document.getElementById('questionSection');
  const answerSection = document.getElementById('answerSection');
  const backBtn = document.getElementById('backBtn');

  // ✅ FAQ 열고 닫기
  if (faqButton && faqModal) {
    faqButton.addEventListener("click", (e) => {
      // 드래그 중이면 클릭 이벤트 무시
      if (isDragging) {
        e.preventDefault();
        return;
      }
      faqModal.classList.toggle("hidden");
      // 모달이 열릴 때 초기 상태로 리셋
      if (!faqModal.classList.contains('hidden')) {
        resetToQuestions();
      }
    });
  }

  if (closeModal && faqModal) {
    closeModal.addEventListener("click", () => {
      faqModal.classList.add("hidden");
      resetToQuestions();
    });
  }

  // ✅ 질문 선택
  document.querySelectorAll(".faq-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      questionSection.classList.add("hidden");
      answerSection.classList.remove("hidden");
      document.querySelectorAll(".faq-answer").forEach(el => el.classList.add("hidden"));
      target.classList.remove("hidden");
    });
  });

  // ✅ 돌아가기
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      resetToQuestions();
    });
  }

  // ✅ 모달 외부 클릭 시 닫기
  document.addEventListener('click', function(event) {
    if (faqContainer && !faqContainer.contains(event.target)) {
      faqModal.classList.add('hidden');
      resetToQuestions();
    }
  });

  function resetToQuestions() {
    if (questionSection && answerSection) {
      questionSection.classList.remove("hidden");
      answerSection.classList.add("hidden");
      document.querySelectorAll(".faq-answer").forEach(el => el.classList.add("hidden"));
    }
  }

  // ✅ 드래그 이동 기능 (웹/모바일 대응)
  let offsetX, offsetY, isDragging = false;
  let dragStartTime = 0;
  const DRAG_THRESHOLD = 5; // 5px 이상 움직여야 드래그로 인식
  let startX, startY;

  // 마우스 이벤트
  if (faqContainer) {
    faqContainer.addEventListener("mousedown", handleDragStart);
  }
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);

  // 터치 이벤트 (모바일)
  if (faqContainer) {
    faqContainer.addEventListener("touchstart", handleTouchStart, { passive: false });
  }
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleDragEnd);

  function handleDragStart(e) {
    const event = e.type === 'touchstart' ? e.touches[0] : e;
    isDragging = false; // 처음에는 false로 시작
    dragStartTime = Date.now();
    
    const rect = faqContainer.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    startX = event.clientX;
    startY = event.clientY;
    
    // 드래그 준비
    faqContainer.style.cursor = 'grabbing';
    faqContainer.style.userSelect = 'none';
    
    e.preventDefault();
  }

  function handleTouchStart(e) {
    handleDragStart(e);
  }

  function handleDragMove(e) {
    if (dragStartTime === 0) return;
    
    const event = e.type === 'touchmove' ? e.touches[0] : e;
    const deltaX = Math.abs(event.clientX - startX);
    const deltaY = Math.abs(event.clientY - startY);
    
    // 임계값을 넘으면 드래그 시작
    if (!isDragging && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
      isDragging = true;
    }
    
    if (!isDragging) return;
    
    // 뷰포트 경계 계산
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerWidth = faqContainer.offsetWidth;
    const containerHeight = faqContainer.offsetHeight;
    
    // 새 위치 계산
    let newX = event.clientX - offsetX;
    let newY = event.clientY - offsetY;
    
    // 경계 제한
    newX = Math.max(0, Math.min(newX, viewportWidth - containerWidth));
    newY = Math.max(0, Math.min(newY, viewportHeight - containerHeight));
    
    // 위치 적용 (fixed 유지)
    faqContainer.style.left = `${newX}px`;
    faqContainer.style.top = `${newY}px`;
    faqContainer.style.bottom = 'auto';
    faqContainer.style.right = 'auto';
    
    e.preventDefault();
  }

  function handleTouchMove(e) {
    handleDragMove(e);
  }

  function handleDragEnd(e) {
    if (dragStartTime === 0) return;
    
    const dragDuration = Date.now() - dragStartTime;
    
    // 드래그가 아닌 경우 (짧은 시간, 작은 움직임)
    if (!isDragging && dragDuration < 200) {
      // 클릭으로 처리 (별도 처리 불필요, 기본 클릭 이벤트가 처리)
    }
    
    // 상태 초기화
    faqContainer.style.cursor = 'default';
    faqContainer.style.userSelect = 'auto';
    
    // 약간의 지연 후 isDragging 해제 (클릭 이벤트와 충돌 방지)
    setTimeout(() => {
      isDragging = false;
      dragStartTime = 0;
    }, 100);
    
    e.preventDefault();
  }

  // ✅ 반응형 위치 조정 (화면 크기 변경 시)
  window.addEventListener('resize', () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerWidth = faqContainer.offsetWidth;
    const containerHeight = faqContainer.offsetHeight;
    
    // 현재 위치가 화면 밖에 있으면 조정
    const currentLeft = parseInt(faqContainer.style.left) || 16;
    const currentTop = parseInt(faqContainer.style.top) || (viewportHeight - containerHeight - 16);
    
    let newLeft = Math.max(16, Math.min(currentLeft, viewportWidth - containerWidth - 16));
    let newTop = Math.max(16, Math.min(currentTop, viewportHeight - containerHeight - 16));
    
    faqContainer.style.left = `${newLeft}px`;
    faqContainer.style.top = `${newTop}px`;
  });

  // ✅ 초기 위치 설정 (기본값: 왼쪽 하단)
  function setInitialPosition() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerHeight = faqContainer.offsetHeight;
    
    // 기본 위치 (왼쪽 하단)
    const defaultLeft = window.innerWidth >= 640 ? 24 : 16; // sm:left-6 = 24px, left-4 = 16px
    const defaultBottom = window.innerWidth >= 640 ? 24 : 16; // sm:bottom-6 = 24px, bottom-4 = 16px
    const defaultTop = viewportHeight - containerHeight - defaultBottom;
    
    faqContainer.style.left = `${defaultLeft}px`;
    faqContainer.style.top = `${defaultTop}px`;
    faqContainer.style.bottom = 'auto';
    faqContainer.style.right = 'auto';
  }

  // 페이지 로드 후 초기 위치 설정
  setTimeout(setInitialPosition, 100);
});