// static/js/components/report_modal.js

class ReportModal {
  constructor(options = {}) {
    this.reportActionUrl = options.reportActionUrl || '';
    this.onSuccess = options.onSuccess || this.defaultSuccessHandler;
    this.onError = options.onError || this.defaultErrorHandler;
    
    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // 신고 버튼 클릭 시 드롭다운 토글
    const reportBtn = document.getElementById('report-btn');
    const reportDropdown = document.getElementById('report-dropdown');
    
    if (reportBtn && reportDropdown) {
      reportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        reportDropdown.classList.toggle('hidden');
      });

      // 문서 클릭 시 드롭다운 닫기
      document.addEventListener('click', (e) => {
        if (!reportBtn.contains(e.target) && !reportDropdown.contains(e.target)) {
          reportDropdown.classList.add('hidden');
        }
      });
    }

    // "부적절한 게시물 신고하기" 클릭 시 모달 열기
    const reportInappropriateBtn = document.getElementById('report-inappropriate-btn');
    if (reportInappropriateBtn) {
      reportInappropriateBtn.addEventListener('click', () => {
        if (reportDropdown) reportDropdown.classList.add('hidden');
        this.openModal();
      });
    }

    // 모달 닫기 이벤트들
    const closeReportModal = document.getElementById('close-report-modal');
    const cancelReportBtn = document.getElementById('cancel-report-btn');
    
    if (closeReportModal) {
      closeReportModal.addEventListener('click', () => this.closeModal());
    }
    
    if (cancelReportBtn) {
      cancelReportBtn.addEventListener('click', () => this.closeModal());
    }

    // 모달 배경 클릭 시 닫기
    const reportModal = document.getElementById('report-modal');
    if (reportModal) {
      reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) {
          this.closeModal();
        }
      });
    }

    // 신고 폼 제출
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
      reportForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // 성공 모달 닫기
    const closeSuccessModal = document.getElementById('close-success-modal');
    if (closeSuccessModal) {
      closeSuccessModal.addEventListener('click', () => {
        const reportSuccessModal = document.getElementById('report-success-modal');
        if (reportSuccessModal) {
          reportSuccessModal.classList.add('hidden');
        }
      });
    }

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const reportModal = document.getElementById('report-modal');
        const reportSuccessModal = document.getElementById('report-success-modal');
        
        if (reportModal && !reportModal.classList.contains('hidden')) {
          this.closeModal();
        }
        if (reportSuccessModal && !reportSuccessModal.classList.contains('hidden')) {
          reportSuccessModal.classList.add('hidden');
        }
      }
    });
  }

  openModal() {
    const reportModal = document.getElementById('report-modal');
    const reportModalContent = document.getElementById('report-modal-content');
    const reportForm = document.getElementById('report-form');
    
    if (reportModal && reportModalContent) {
      reportModal.classList.remove('hidden');
      setTimeout(() => {
        reportModalContent.classList.remove('scale-95', 'opacity-0');
        reportModalContent.classList.add('scale-100', 'opacity-100');
      }, 10);
      
      // 폼 액션 URL 설정
      if (reportForm && this.reportActionUrl) {
        reportForm.action = this.reportActionUrl;
      }
    }
  }

  closeModal() {
    const reportModal = document.getElementById('report-modal');
    const reportModalContent = document.getElementById('report-modal-content');
    const reportForm = document.getElementById('report-form');
    const submitReportBtn = document.getElementById('submit-report-btn');
    
    if (reportModal && reportModalContent) {
      reportModalContent.classList.remove('scale-100', 'opacity-100');
      reportModalContent.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        reportModal.classList.add('hidden');
        // 폼 리셋
        if (reportForm) {
          reportForm.reset();
        }
        // 제출 버튼 활성화
        if (submitReportBtn) {
          submitReportBtn.disabled = false;
          submitReportBtn.textContent = '신고하기';
        }
      }, 300);
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const reportForm = document.getElementById('report-form');
    const submitReportBtn = document.getElementById('submit-report-btn');
    const formData = new FormData(reportForm);
    const reason = formData.get('reason');
    
    if (!reason) {
      alert('신고 사유를 선택해주세요.');
      return;
    }

    // 제출 버튼 비활성화
    if (submitReportBtn) {
      submitReportBtn.disabled = true;
      submitReportBtn.textContent = '신고 중...';
    }

    try {
      const response = await fetch(reportForm.action, {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRFToken': this.getCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await response.json();

      if (data.success) {
        this.closeModal();
        this.showSuccessModal();
        this.onSuccess(data);
      } else {
        this.onError(data.error || data.message || '신고 처리 중 오류가 발생했습니다.');
        this.resetSubmitButton();
      }
    } catch (error) {
      console.error('신고 오류:', error);
      this.onError('신고 처리 중 오류가 발생했습니다.');
      this.resetSubmitButton();
    }
  }

  resetSubmitButton() {
    const submitReportBtn = document.getElementById('submit-report-btn');
    if (submitReportBtn) {
      submitReportBtn.disabled = false;
      submitReportBtn.textContent = '신고하기';
    }
  }

  showSuccessModal() {
    const reportSuccessModal = document.getElementById('report-success-modal');
    if (reportSuccessModal) {
      reportSuccessModal.classList.remove('hidden');
    }
  }

  getCsrfToken() {
    // CSRF 토큰 가져오기 (여러 방법 시도)
    return window.csrfToken || 
           document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
           document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
           '';
  }

  // 기본 핸들러들
  defaultSuccessHandler(data) {
    console.log('신고가 성공적으로 접수되었습니다:', data);
  }

  defaultErrorHandler(error) {
    alert(error);
  }

  // 정적 메서드로 쉬운 초기화 제공
  static init(options = {}) {
    return new ReportModal(options);
  }
}

// 전역으로 사용할 수 있도록 export
window.ReportModal = ReportModal;