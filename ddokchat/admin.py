# ddokchat/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from datetime import timedelta
from .models import ChatRoom, TradeReport

@admin.register(TradeReport)
class TradeReportAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'reporter_link', 'reported_user_link', 'reason', 
        'trade_product_display', 'trade_category_display', 'damage_amount_display',
        'status', 'created_at', 'processed_at'
    )
    
    list_filter = (
        'status', 'reason', 'created_at', 'processed_at',
        'chatroom__content_type'  # 거래 타입별 필터
    )
    
    search_fields = (
        'reporter__username', 'reported_user__username', 
        'description', 'chatroom__id'
    )
    
    readonly_fields = (
        'reporter', 'reported_user', 'chatroom', 'created_at', 
        'trade_info_preview', 'chat_history_preview'
    )
    
    fieldsets = (
        ('신고 정보', {
            'fields': (
                'reporter', 'reported_user', 'chatroom', 'reason', 
                'description', 'evidence_text', 'damage_amount', 'created_at'
            )
        }),
        ('거래 정보 미리보기', {
            'fields': ('trade_info_preview',),
            'classes': ('collapse',)
        }),
        ('채팅 내역 미리보기', {
            'fields': ('chat_history_preview',),
            'classes': ('collapse',)
        }),
        ('처리 정보', {
            'fields': (
                'status', 'admin_notes', 'processed_by', 'processed_at',
                'restriction_applied', 'restriction_start', 'restriction_end'
            )
        }),
    )
    
    ordering = ['-created_at']
    
    def reporter_link(self, obj):
        """신고자 링크"""
        if obj.reporter:
            return format_html(
                '<a href="/admin/accounts/user/{}/change/" target="_blank">{}</a>',
                obj.reporter.id, obj.reporter.username
            )
        return '-'
    reporter_link.short_description = '신고자'
    
    def reported_user_link(self, obj):
        """신고당한 사용자 링크"""
        if obj.reported_user:
            return format_html(
                '<a href="/admin/accounts/user/{}/change/" target="_blank">{}</a>',
                obj.reported_user.id, obj.reported_user.username
            )
        return '-'
    reported_user_link.short_description = '신고 대상 유저'
    
    def trade_product_display(self, obj):
        """거래 상품 정보 표시 (링크 포함)"""
        try:
            if obj.chatroom and obj.chatroom.post:
                post = obj.chatroom.post
                title = getattr(post, 'title', '제목 없음')
                
                # 거래 타입에 따른 URL 생성
                category = obj.get_trade_category()
                category_map = {'양도': 'sell', '대여': 'rental', '분철': 'split'}
                category_slug = category_map.get(category, 'sell')
                
                return format_html(
                    '<a href="/ddokfarm/{}/{}/" target="_blank" title="{}">{}...</a>',
                    category_slug, post.id, title, title[:30]
                )
        except Exception as e:
            print(f"거래 상품 표시 오류: {e}")
        return '삭제된 게시글'
    trade_product_display.short_description = '거래 상품'
    
    def trade_category_display(self, obj):
        """거래 카테고리 표시"""
        return obj.get_trade_category()
    trade_category_display.short_description = '거래 유형'
    
    def damage_amount_display(self, obj):
        """피해 금액 표시 - 수정된 버전"""
        if obj.damage_amount:
            return format_html(
                '<span style="color: red; font-weight: bold;">{} 원</span>',
                f"{obj.damage_amount:,}"  # 🔥 수정: 포맷팅을 먼저 처리
            )
        return '-'
    damage_amount_display.short_description = '피해 금액'
    
    def trade_info_preview(self, obj):
        """거래 정보 미리보기 - 수정된 버전"""
        try:
            if obj.chatroom and obj.chatroom.post:
                post = obj.chatroom.post
                
                # 🔥 수정: 안전한 금액 포맷팅
                try:
                    trade_amount = obj.get_trade_amount()
                    amount_text = f"{trade_amount:,}" if trade_amount else "0"
                except:
                    amount_text = "알 수 없음"
                
                info = f"""
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <h4>거래 상품 정보</h4>
                    <p><strong>제목:</strong> {getattr(post, 'title', 'N/A')}</p>
                    <p><strong>카테고리:</strong> {obj.get_trade_category()}</p>
                    <p><strong>거래 금액:</strong> {amount_text}원</p>
                    <p><strong>채팅방 ID:</strong> {obj.chatroom.id}</p>
                    <p><strong>게시글 작성자:</strong> {getattr(post, 'user', 'N/A')}</p>
                </div>
                """
                return format_html(info)
        except Exception as e:
            print(f"거래 정보 미리보기 오류: {e}")
        return '정보를 불러올 수 없습니다.'
    trade_info_preview.short_description = '거래 정보'
    
    def chat_history_preview(self, obj):
        """채팅 내역 미리보기 (최근 10개 메시지)"""
        try:
            if obj.chatroom:
                from .models import Message
                messages = Message.objects.filter(
                    room=obj.chatroom
                ).select_related('sender').order_by('-timestamp')[:10]
                
                if messages:
                    history = '<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; max-height: 300px; overflow-y: auto;">'
                    history += '<h4>최근 채팅 내역</h4>'
                    
                    for msg in reversed(messages):
                        sender_name = msg.sender.username if msg.sender else 'Unknown'
                        msg_time = msg.timestamp.strftime('%m/%d %H:%M')
                        
                        # 메시지 타입별 내용 표시
                        if msg.message_type == 'text' and hasattr(msg, 'text_content'):
                            content = msg.text_content.content[:50]
                        elif msg.message_type == 'image':
                            content = '[이미지]'
                        elif msg.message_type == 'account_info':
                            content = '[계좌정보]'
                        elif msg.message_type == 'address_info':
                            content = '[배송정보]'
                        else:
                            content = '[메시지]'
                        
                        history += f'<p style="margin: 5px 0; padding: 5px; border-left: 3px solid #dee2e6;"><small>{msg_time}</small> <strong>{sender_name}:</strong> {content}</p>'
                    
                    history += '</div>'
                    return format_html(history)
                else:
                    return '채팅 내역이 없습니다.'
        except Exception as e:
            print(f"채팅 내역 미리보기 오류: {e}")
        return '채팅 내역을 불러올 수 없습니다.'
    chat_history_preview.short_description = '채팅 내역'
    
    @admin.action(description="🟡 경고 처리 (3일 제재)")
    def action_warning(self, request, queryset):
        """경고 처리 + 3일 제재"""
        processed_count = 0
        
        for report in queryset.filter(status='pending'):
            user = report.reported_user
            if user:
                try:
                    # 사용자 제재 (3일)
                    user.suspend_user(f"거래 신고 처리 - {report.get_reason_display()}", days=3)
                    processed_count += 1
                    
                    # 신고 처리 완료
                    report.status = 'resolved'
                    report.processed_at = timezone.now()
                    report.processed_by = request.user
                    report.admin_notes = f"경고 처리 (3일 제재) - 관리자: {request.user.username}"
                    report.restriction_applied = True
                    report.restriction_start = timezone.now()
                    report.restriction_end = timezone.now() + timedelta(days=3)
                    report.save()
                    
                except Exception as e:
                    print(f"사용자 제재 실패: {e}")
        
        self.message_user(request, f"{processed_count}건의 신고를 경고 처리했습니다. (3일 제재)")
    
    @admin.action(description="🟠 일시정지 처리 (14일 제재)")
    def action_suspension(self, request, queryset):
        """일시정지 처리 + 14일 제재"""
        processed_count = 0
        
        for report in queryset.filter(status='pending'):
            user = report.reported_user
            if user:
                try:
                    # 사용자 제재 (14일)
                    user.suspend_user(f"거래 신고 처리 - {report.get_reason_display()}", days=14)
                    processed_count += 1
                    
                    # 신고 처리 완료
                    report.status = 'resolved'
                    report.processed_at = timezone.now()
                    report.processed_by = request.user
                    report.admin_notes = f"일시정지 처리 (14일 제재) - 관리자: {request.user.username}"
                    report.restriction_applied = True
                    report.restriction_start = timezone.now()
                    report.restriction_end = timezone.now() + timedelta(days=14)
                    report.save()
                    
                except Exception as e:
                    print(f"사용자 제재 실패: {e}")
        
        self.message_user(request, f"{processed_count}건의 신고를 일시정지 처리했습니다. (14일 제재)")
    
    @admin.action(description="🔴 영구정지 처리")
    def action_permanent_ban(self, request, queryset):
        """영구정지 처리"""
        processed_count = 0
        
        for report in queryset.filter(status='pending'):
            user = report.reported_user
            if user:
                try:
                    # 사용자 영구 제재
                    user.suspend_user(f"거래 신고 처리 - {report.get_reason_display()} (영구정지)")
                    user.is_active = False
                    user.save(update_fields=['is_active'])
                    processed_count += 1
                    
                    # 신고 처리 완료
                    report.status = 'resolved'
                    report.processed_at = timezone.now()
                    report.processed_by = request.user
                    report.admin_notes = f"영구정지 처리 - 관리자: {request.user.username}"
                    report.restriction_applied = True
                    report.restriction_start = timezone.now()
                    report.restriction_end = None
                    report.save()
                    
                except Exception as e:
                    print(f"사용자 영구정지 실패: {e}")
        
        self.message_user(request, f"{processed_count}건의 신고를 영구정지 처리했습니다.")
    
    @admin.action(description="✅ 신고 기각")
    def action_dismiss(self, request, queryset):
        """신고 기각 처리"""
        for report in queryset.filter(status='pending'):
            report.status = 'rejected'
            report.processed_at = timezone.now()
            report.processed_by = request.user
            report.admin_notes = f"신고 기각됨 - 관리자: {request.user.username}"
            report.save()
            
        self.message_user(request, f"{queryset.count()}건의 신고를 기각 처리했습니다.")
    
    actions = [
        'action_warning', 'action_suspension', 
        'action_permanent_ban', 'action_dismiss'
    ]