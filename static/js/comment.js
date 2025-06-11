// ✅ 댓글 스크롤 함수 (알림에서 올 때)
function scrollToCommentFromNotification() {
  const urlParams = new URLSearchParams(window.location.search);
  const commentId = urlParams.get('scroll_to_comment');
  
  if (commentId) {
    const commentElement = document.querySelector(`#comment-${commentId}`);
    
    if (commentElement) {
      setTimeout(() => {
        commentElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 500);
      
      // URL에서 파라미터 제거
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }
}

// ✅ CSRF 토큰 가져오는 함수
function getCsrfToken() {
  const tokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
  if (tokenInput && tokenInput.value) {
    return tokenInput.value;
  }
  
  const metaToken = document.querySelector('meta[name="csrf-token"]');
  if (metaToken) {
    return metaToken.getAttribute('content');
  }
  
  if (typeof window.csrfToken !== 'undefined') {
    return window.csrfToken;
  }
  
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  
  if (cookieValue) {
    return cookieValue;
  }
  
  return '';
}

// ✅ reply-toggle-btn 클릭 시 대댓글 입력 폼 열기/닫기
document.addEventListener("click", function (e) {
  if (e.target.matches(".reply-toggle-btn")) {
    const commentId = e.target.dataset.commentId;
    const form = document.getElementById(`reply-form-${commentId}`);
    if (form) {
      form.classList.toggle("hidden");
    }
  }
});

// ✅ 댓글 영역 전체 새로고침 함수
async function refreshCommentSection() {
  try {
    const currentUrl = window.location.href;
    const response = await fetch(currentUrl, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const newCommentSection = doc.querySelector('.comment-section');
      const currentCommentSection = document.querySelector('.comment-section');
      
      if (newCommentSection && currentCommentSection) {
        currentCommentSection.innerHTML = newCommentSection.innerHTML;
        
        const newCsrfToken = doc.querySelector("[name=csrfmiddlewaretoken]");
        if (newCsrfToken && newCsrfToken.value) {
          window.csrfToken = newCsrfToken.value;
        }
        
        bindAllEvents();
        scrollToCommentFromNotification();
      }
    }
  } catch (error) {
    console.error('댓글 영역 새로고침 실패:', error);
    window.location.reload();
  }
}

// ✅ 댓글 폼 submit 처리 함수
async function handleCommentSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const url = form.getAttribute("action");
  const csrfToken = getCsrfToken();
  
  if (!csrfToken) {
    alert('CSRF 토큰을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  const formData = new FormData(form);
  formData.delete('csrfmiddlewaretoken');
  formData.append('csrfmiddlewaretoken', csrfToken);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrfToken,
        "X-Requested-With": "XMLHttpRequest"
      },
      body: formData,
    });

    if (response.ok) {
      await refreshCommentSection();
    } else {
      alert(`댓글 등록에 실패했습니다. (${response.status})`);
    }
  } catch (error) {
    alert("댓글 등록 중 오류가 발생했습니다.");
  }
}

// ✅ 삭제 버튼 바인딩 함수
function bindDeleteButtons(scope = document) {
  scope.querySelectorAll(".delete-comment-btn").forEach(btn => {
    if (btn.hasAttribute('data-bound')) return;
    btn.setAttribute('data-bound', 'true');
    
    btn.addEventListener("click", async (e) => {
      const confirmed = confirm("댓글을 삭제하시겠습니까?");
      if (!confirmed) return;

      const url = btn.dataset.deleteUrl;
      const csrfToken = getCsrfToken();

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "X-CSRFToken": csrfToken,
            "X-Requested-With": "XMLHttpRequest"
          }
        });

        if (response.ok) {
          await refreshCommentSection();
        } else {
          alert("댓글 삭제에 실패했습니다.");
        }
      } catch (error) {
        alert("댓글 삭제 중 오류가 발생했습니다.");
      }
    });
  });
}

// ✅ 모든 이벤트 바인딩
function bindAllEvents() {
  document.querySelectorAll("form[id^='comment-form']").forEach(form => {
    form.removeAttribute('data-bound');
    if (!form.hasAttribute('data-bound')) {
      form.setAttribute('data-bound', 'true');
      form.addEventListener("submit", handleCommentSubmit);
    }
  });

  bindDeleteButtons();
}

document.addEventListener('DOMContentLoaded', () => {
  bindAllEvents();
  scrollToCommentFromNotification();
});