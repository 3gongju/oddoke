@login_required
def account_verification(request, username):
    """계좌 인증 페이지"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 등록할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 이미 등록된 계좌가 있는지 확인
    if user_profile.is_account_verified:
        messages.info(request, '이미 등록된 계좌가 있습니다.')
        return redirect('accounts:mypage')
    
    if request.method == 'POST':
        form = BankAccountForm(request.POST, instance=user_profile)
        if form.is_valid():
            bank_code = form.cleaned_data['bank_code']
            account_number = form.cleaned_data['account_number']
            account_holder = form.cleaned_data['account_holder']
            
            # Mock 계좌인증 서비스 호출
            bank_service = get_bank_service()
            result = bank_service.verify_account(bank_code, account_number, account_holder)
            
            if result['success']:
                # 인증 성공 - 계좌 정보 저장
                user_profile.bank_code = bank_code
                user_profile.bank_name = bank_service.get_bank_name(bank_code)
                user_profile.account_number = account_number
                user_profile.account_holder = account_holder
                user_profile.is_account_verified = True
                user_profile.account_registered_at = now()
                user_profile.save()
                
                messages.success(request, f'✅ {result["message"]}')
                return redirect('accounts:mypage')
            else:
                # 인증 실패
                messages.error(request, f'❌ {result["message"]}')
                
    else:
        form = BankAccountForm()
    
    # Mock 서비스의 지원 은행 목록 가져오기
    bank_service = get_bank_service()
    supported_banks = bank_service.get_supported_banks()
    
    context = {
        'user_profile': user_profile,
        'form': form,
        'supported_banks': supported_banks,
        'bank_service': bank_service,
    }
    return render(request, 'accounts/account_verification.html', context)

@login_required  
def account_delete(request, username):
    """등록된 계좌정보 삭제"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 삭제할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 등록된 계좌가 없는 경우
    if not user_profile.is_account_verified:
        messages.warning(request, '등록된 계좌가 없습니다.')
        return redirect('accounts:mypage')
    
    if request.method == 'POST':
        # 계좌정보 삭제
        user_profile.bank_code = None
        user_profile.bank_name = None  
        user_profile.account_number = None
        user_profile.account_holder = None
        user_profile.is_account_verified = False
        user_profile.account_registered_at = None
        user_profile.save()
        
        messages.success(request, '💳 계좌정보가 삭제되었습니다.')
        return redirect('accounts:mypage')
    
    return render(request, 'accounts/account_delete_confirm.html', {
        'user_profile': user_profile
    })

@login_required
def account_status(request, username):
    """계좌 인증 상태 조회 (AJAX)"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        return JsonResponse({'error': '접근 권한이 없습니다.'}, status=403)
    
    if user_profile.is_account_verified:
        # 계좌번호 마스킹 처리 (뒤 4자리만 표시)
        masked_account = None
        if user_profile.account_number:
            if len(user_profile.account_number) > 4:
                masked_account = '****' + user_profile.account_number[-4:]
            else:
                masked_account = '****'
    
        data = {
            'is_verified': True,
            'bank_name': user_profile.bank_name,
            'account_number': masked_account,
            'account_holder': user_profile.account_holder,
            'registered_at': user_profile.account_registered_at.strftime('%Y-%m-%d %H:%M') if user_profile.account_registered_at else None,
        }
    else:
        data = {
            'is_verified': False,
            'bank_name': None,
            'account_number': None,
            'account_holder': None,
            'registered_at': None,
        }
    
    return JsonResponse(data)

@login_required
def account_modify(request, username):
    """등록된 계좌정보 수정"""
    user_profile = get_object_or_404(User, username=username)
    
    # 본인만 접근 가능
    if request.user != user_profile:
        messages.error(request, '본인의 계좌만 수정할 수 있습니다.')
        return redirect('accounts:mypage')
    
    # 등록된 계좌가 없는 경우 
    if not user_profile.is_account_verified:
        messages.warning(request, '등록된 계좌가 없습니다. 먼저 계좌를 등록해주세요.')
        return redirect('accounts:account_verification', username=username)
    
    if request.method == 'POST':
        form = BankAccountForm(request.POST, instance=user_profile)
        if form.is_valid():
            bank_code = form.cleaned_data['bank_code']
            account_number = form.cleaned_data['account_number']
            account_holder = form.cleaned_data['account_holder']
            
            # Mock 계좌인증 서비스 호출
            bank_service = get_bank_service()
            result = bank_service.verify_account(bank_code, account_number, account_holder)
            
            if result['success']:
                # 인증 성공 - 계좌 정보 업데이트
                user_profile.bank_code = bank_code
                user_profile.bank_name = bank_service.get_bank_name(bank_code)
                user_profile.account_number = account_number
                user_profile.account_holder = account_holder
                user_profile.is_account_verified = True
                user_profile.account_registered_at = now()
                user_profile.save()
                
                messages.success(request, f'✅ 계좌정보가 수정되었습니다. {result["message"]}')
                return redirect('accounts:mypage')
            else:
                # 인증 실패
                messages.error(request, f'❌ {result["message"]}')
                
    else:
        # 기존 정보로 폼 초기화
        form = BankAccountForm(instance=user_profile)
    
    # Mock 서비스의 지원 은행 목록 가져오기
    bank_service = get_bank_service()
    supported_banks = bank_service.get_supported_banks()
    
    context = {
        'user_profile': user_profile,
        'form': form,
        'supported_banks': supported_banks,
        'bank_service': bank_service,
        'is_modify': True,  # 수정 모드임을 표시
    }
    return render(request, 'accounts/account_verification.html', context)