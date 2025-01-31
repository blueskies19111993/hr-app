document.addEventListener('DOMContentLoaded', () => {
    // Check authentication status
    checkAuth();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load initial data
    loadDashboardData();
});

async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = 'index.html';
        return;
    }
}

function initializeEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = 'index.html';
        }
    });

    // Request form submission
    const requestForm = document.getElementById('requestForm');
    if (requestForm) {
        requestForm.addEventListener('submit', handleRequestSubmission);
    }

    // Draft button
    const draftBtn = document.querySelector('.draft-btn');
    if (draftBtn) {
        draftBtn.addEventListener('click', saveDraft);
    }

    // Add attachment button
    const addAttachmentBtn = document.getElementById('addAttachmentBtn');
    if (addAttachmentBtn) {
        addAttachmentBtn.addEventListener('click', addAttachmentInput);
    }

    // Other request type toggle
    const requestType = document.getElementById('requestType');
    if (requestType) {
        requestType.addEventListener('change', toggleOtherRequestType);
    }
}

async function loadDashboardData() {
    try {
        // Get user profile
        const { data: { user } } = await supabase.auth.getUser();
        
        // Load requests statistics
        const stats = await loadRequestStats(user.id);
        updateDashboardStats(stats);
        
        // Load recent requests
        const requests = await loadRecentRequests(user.id);
        displayRecentRequests(requests);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

async function loadRequestStats(userId) {
    const { data, error } = await supabase
        .from('requests')
        .select('status')
        .eq('user_id', userId);

    if (error) throw error;

    return {
        pending: data.filter(r => r.status === 'pending').length,
        approved: data.filter(r => r.status === 'approved').length,
        rejected: data.filter(r => r.status === 'rejected').length
    };
}

function updateDashboardStats(stats) {
    document.querySelector('.stat-card:nth-child(1) p').textContent = stats.pending;
    document.querySelector('.stat-card:nth-child(2) p').textContent = stats.approved;
    document.querySelector('.stat-card:nth-child(3) p').textContent = stats.rejected;
}

async function loadRecentRequests(userId) {
    const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) throw error;
    return data;
}

function displayRecentRequests(requests) {
    const requestList = document.querySelector('.request-list');
    requestList.innerHTML = '';

    requests.forEach(request => {
        const requestElement = createRequestElement(request);
        requestList.appendChild(requestElement);
    });
}

function createRequestElement(request) {
    const div = document.createElement('div');
    div.className = 'request-item';
    div.innerHTML = `
        <div class="request-header">
            <h3>${request.title}</h3>
            <span class="status ${request.status}">${request.status}</span>
        </div>
        <p>${request.description}</p>
        <div class="request-footer">
            <span class="date">${new Date(request.created_at).toLocaleDateString()}</span>
            <button onclick="viewRequest('${request.id}')" class="view-btn">View Details</button>
        </div>
    `;
    return div;
}

async function handleRequestSubmission(e) {
    e.preventDefault();
    
    try {
        showLoader();
        
        // جمع بيانات النموذج
        const formData = new FormData();
        formData.append('type', document.getElementById('requestType').value);
        
        if (formData.get('type') === 'other') {
            formData.append('customType', document.getElementById('otherRequestType').value);
        }
        
        formData.append('title', document.getElementById('requestTitle').value);
        formData.append('description', document.getElementById('requestDescription').value);
        
        // إضافة المرفقات
        const attachments = document.querySelectorAll('.file-input');
        let attachmentCount = 0;
        
        for (const input of attachments) {
            if (input.files.length > 0) {
                formData.append(`attachment${attachmentCount}`, input.files[0]);
                attachmentCount++;
            }
        }
        
        // الحصول على معرف المستخدم
        const { data: { user } } = await supabase.auth.getUser();
        formData.append('user_id', user.id);
        
        // رفع البيانات إلى Supabase
        const { data, error } = await supabase
            .from('requests')
            .insert([{
                type: formData.get('type'),
                custom_type: formData.get('customType'),
                title: formData.get('title'),
                description: formData.get('description'),
                user_id: formData.get('user_id'),
                status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // رفع المرفقات
        const requestId = data.id;
        for (let i = 0; i < attachmentCount; i++) {
            const file = formData.get(`attachment${i}`);
            const filePath = `${user.id}/${requestId}/${file.name}`;
            
            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;
        }

        showNotification('تم تقديم الطلب بنجاح', 'success');
        e.target.reset();
        loadDashboardData();
        
    } catch (error) {
        console.error('Error submitting request:', error);
        showNotification('حدث خطأ أثناء تقديم الطلب', 'error');
    } finally {
        hideLoader();
    }
}

async function saveDraft() {
    const formData = {
        type: document.getElementById('requestType').value,
        title: document.getElementById('requestTitle').value,
        description: document.getElementById('requestDescription').value,
        status: 'draft',
        created_at: new Date().toISOString()
    };

    try {
        const { data: { user } } = await supabase.auth.getUser();
        formData.user_id = user.id;

        const { data, error } = await supabase
            .from('request_drafts')
            .insert([formData]);

        if (error) throw error;

        showNotification('Draft saved successfully', 'success');
    } catch (error) {
        console.error('Error saving draft:', error);
        showNotification('Failed to save draft', 'error');
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Add this to your window object to make it accessible from HTML
window.viewRequest = async function(requestId) {
    try {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (error) throw error;

        // Here you would typically open a modal or navigate to a details page
        // For now, we'll just log the data
        console.log('Request details:', data);
    } catch (error) {
        console.error('Error fetching request details:', error);
        showNotification('Failed to load request details', 'error');
    }
};

// التعامل مع المرفقات
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function addAttachmentInput() {
    const container = document.getElementById('attachmentsContainer');
    const attachments = container.querySelectorAll('.attachment-input');
    
    if (attachments.length >= MAX_ATTACHMENTS) {
        showNotification('لا يمكن إضافة أكثر من 5 مرفقات', 'warning');
        return;
    }

    const newAttachment = document.createElement('div');
    newAttachment.className = 'attachment-input fade-in';
    newAttachment.innerHTML = `
        <input type="file" 
               class="file-input" 
               accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" 
               onchange="handleFileSelect(this)">
        <button type="button" class="remove-attachment" onclick="removeAttachment(this)">
            <i class="fas fa-times"></i>
        </button>
        <div class="upload-progress" style="display: none;">
            <div class="upload-progress-bar"></div>
        </div>
    `;
    
    container.appendChild(newAttachment);
}

function removeAttachment(button) {
    const attachmentInput = button.parentElement;
    attachmentInput.classList.add('fade-out');
    setTimeout(() => attachmentInput.remove(), 300);
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    // التحقق من حجم الملف
    if (file.size > MAX_FILE_SIZE) {
        showFileError(input, 'حجم الملف يتجاوز 2 ميجابايت');
        input.value = '';
        return;
    }

    // التحقق من نوع الملف
    if (!ALLOWED_TYPES.includes(file.type)) {
        showFileError(input, 'نوع الملف غير مدعوم');
        input.value = '';
        return;
    }

    // إظهار معاينة الملف
    showFilePreview(input, file);
}

function showFilePreview(input, file) {
    const container = input.parentElement;
    let preview = container.querySelector('.file-preview');
    
    if (!preview) {
        preview = document.createElement('div');
        preview.className = 'file-preview fade-in';
        container.appendChild(preview);
    }

    // إذا كان الملف صورة
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <div class="preview-content">
                    <img src="${e.target.result}" alt="${file.name}" class="preview-image">
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                <div class="preview-actions">
                    <button type="button" class="preview-btn" onclick="removeAttachment(this.parentElement.parentElement)">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            `;
        };
        reader.readAsDataURL(file);
    } 
    // إذا كان الملف PDF
    else if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <div class="preview-content">
                    <div class="pdf-preview">
                        <i class="fas fa-file-pdf fa-3x"></i>
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${formatFileSize(file.size)}</div>
                        </div>
                    </div>
                    <div class="preview-actions">
                        <button type="button" class="preview-btn" onclick="previewPDF('${e.target.result}')">
                            <i class="fas fa-eye"></i> معاينة
                        </button>
                        <button type="button" class="preview-btn" onclick="removeAttachment(this.parentElement.parentElement.parentElement)">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </div>
                </div>
            `;
        };
        reader.readAsDataURL(file);
    }
    // للملفات الأخرى (Word وغيرها)
    else {
        const icon = getFileIcon(file.type);
        preview.innerHTML = `
            <div class="preview-content">
                <div class="file-preview-icon">
                    <i class="fas ${icon} fa-3x"></i>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                <div class="preview-actions">
                    <button type="button" class="preview-btn" onclick="removeAttachment(this.parentElement.parentElement)">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
        `;
    }
}

// دالة لمعاينة ملفات PDF
function previewPDF(dataUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal fade-in';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>معاينة PDF</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <iframe src="${dataUrl}" width="100%" height="500px"></iframe>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function getFileIcon(fileType) {
    const icons = {
        'application/pdf': 'fa-file-pdf',
        'image/jpeg': 'fa-file-image',
        'image/png': 'fa-file-image',
        'application/msword': 'fa-file-word',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fa-file-word'
    };

    const iconClass = icons[fileType] || 'fa-file';
    return `<i class="fas ${iconClass}"></i>`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showFileError(input, message) {
    const container = input.parentElement;
    container.classList.add('file-error');
    
    let errorDiv = container.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        container.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    
    setTimeout(() => {
        container.classList.remove('file-error');
        errorDiv.remove();
    }, 3000);
}

// التعامل مع نوع الطلب "أخرى"
function toggleOtherRequestType() {
    const requestType = document.getElementById('requestType');
    const otherGroup = document.getElementById('otherRequestTypeGroup');
    const otherInput = document.getElementById('otherRequestType');
    
    if (requestType.value === 'other') {
        otherGroup.style.display = 'block';
        otherInput.required = true;
    } else {
        otherGroup.style.display = 'none';
        otherInput.required = false;
    }
}
